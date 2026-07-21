// A module-level (not React-state) store for the Owner's "Auto Shift Scheduling" AI generation run.
//
// It intentionally lives outside any component so a run keeps streaming and updating in the
// background even after the Owner navigates away from /owner/shifts (the page component that owns
// the wizard UI unmounts on route change, but this module does not). src/app/owner/layout.tsx
// mounts a small floating status widget that subscribes to this store and stays visible across
// every /owner/* page, and the Shifts page itself reads/writes through the same store instead of
// local state so edits (drag-reassign, selection) survive a navigate-away-and-back too.
import { AiShiftSlot } from '@/types/SchedulingRule'

// The backend suggestion payload carries no per-slot id. We mint one on receipt (see the 'block'
// event handler below) and key selection/drag-reassign off it instead of the slot's position in
// the array — array index breaks the moment a sibling slot is removed (splice reindexes whatever
// shifted into the vacated slot, silently deselecting it).
export type AiShiftSlotWithKey = AiShiftSlot & { key: string }

export type AutoShiftBlock = {
  key: string
  department_id: string
  department_name: string
  shift_date: string
  slots: AiShiftSlotWithKey[]
  warning: string | null
}

export type AiScheduleKnownRow = { name: string; deptId: string; deptName: string }
export type AiScheduleAvailability = { fixedOffDates: Set<string>; approvedLeaveDates: Set<string> }
export type AiScheduleGenerationStatus = 'idle' | 'generating' | 'done' | 'error'

export type AiScheduleGenerationParams = {
  companyId: string
  userId: string
  dateFrom: string
  dateTo: string
  departmentIds: string[]
  shiftTypes: { label: string; start_time: string; end_time: string }[]
}

type AiScheduleGenerationState = {
  status: AiScheduleGenerationStatus
  progress: number
  ruleStepIndex: number
  notice: string
  error: string
  blocks: AutoShiftBlock[]
  selected: Set<string>
  knownRows: Map<string, AiScheduleKnownRow>
  staffAvailability: Map<string, AiScheduleAvailability>
  params: AiScheduleGenerationParams | null
  // Set only by the floating widget's onClick (see AiScheduleStatusWidget), consumed by the Shifts
  // page the moment it acts on it. This must be an explicit one-shot request, not a "run is
  // non-idle" check on mount — landing on /owner/shifts any other way (sidebar nav, direct URL,
  // browser back) must NOT pop the wizard open uninvited; only clicking the widget (or the page's
  // own "AI Schedule" button, handled separately) should.
  pendingOpen: boolean
  // Whether the Owner has clicked the floating widget for this run yet. Drives the "breathing"
  // attention animation on the widget (see AiScheduleStatusWidget) — it pulses while generating and
  // while a finished draft is still unreviewed, and stops the moment they click through. Reset false
  // at the start of every new run so a fresh generation always grabs attention again.
  acknowledged: boolean
}

export const AI_SCHEDULE_RULE_STEPS = [
  'Checking approved leave for the selected departments…',
  'Checking weekly days off…',
  'Calculating weekly working hour limits (44h/week)…',
  'Ensuring at least 1 manager and 1 employee per department each day…',
  'Limiting consecutive working days (max 3)…',
  'Rotating weekend duty fairly…',
  'Balancing workload across staff…',
  'Finalizing the draft schedule…',
]

const idleState: AiScheduleGenerationState = {
  status: 'idle',
  progress: 0,
  ruleStepIndex: 0,
  notice: '',
  error: '',
  blocks: [],
  selected: new Set(),
  knownRows: new Map(),
  staffAvailability: new Map(),
  params: null,
  pendingOpen: false,
  acknowledged: false,
}

let state: AiScheduleGenerationState = idleState
const listeners = new Set<() => void>()
let abortController: AbortController | null = null
let ruleStepTimer: ReturnType<typeof setInterval> | null = null

function setState(partial: Partial<AiScheduleGenerationState>) {
  state = { ...state, ...partial }
  listeners.forEach(listener => listener())
}

function stopRuleStepTimer() {
  if (ruleStepTimer) { clearInterval(ruleStepTimer); ruleStepTimer = null }
}

function stopRun() {
  abortController?.abort()
  abortController = null
  stopRuleStepTimer()
}

export const aiScheduleGenerationStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },

  getSnapshot(): AiScheduleGenerationState {
    return state
  },

  setBlocks(updater: (prev: AutoShiftBlock[]) => AutoShiftBlock[]) {
    setState({ blocks: updater(state.blocks) })
  },

  setSelected(updater: (prev: Set<string>) => Set<string>) {
    setState({ selected: updater(state.selected) })
  },

  // Called by the floating widget's onClick. Sets a one-shot flag the Shifts page consumes (see
  // consumeOpenRequest) to reopen the wizard — whether that page mounts fresh right after (the
  // Owner was elsewhere) or is already sitting there (a click there navigates nowhere).
  requestOpen() {
    setState({ pendingOpen: true, acknowledged: true })
  },

  // The Shifts page calls this once it's acted on a pending open request, so the same request
  // doesn't re-fire on a later unrelated render/mount.
  consumeOpenRequest() {
    setState({ pendingOpen: false })
  },

  // Aborts the in-flight run (if any) and clears everything back to idle — used both to cancel a
  // run in progress and to "acknowledge and dismiss" a finished/errored one. pendingOpen survives
  // this so a click racing a clear can still be acted on.
  clear() {
    stopRun()
    state = { ...idleState, pendingOpen: state.pendingOpen }
    listeners.forEach(listener => listener())
  },

  async startGeneration(input: AiScheduleGenerationParams, departmentNames: Map<string, string>) {
    stopRun()
    const controller = new AbortController()
    abortController = controller
    setState({
      status: 'generating',
      progress: 0,
      ruleStepIndex: 0,
      notice: '',
      error: '',
      blocks: [],
      selected: new Set(),
      knownRows: new Map(),
      staffAvailability: new Map(),
      params: input,
      acknowledged: false,
    })
    ruleStepTimer = setInterval(() => {
      setState({ ruleStepIndex: Math.min(state.ruleStepIndex + 1, AI_SCHEDULE_RULE_STEPS.length - 1) })
    }, 2200)

    const received: AutoShiftBlock[] = []
    let expectedBlockCount = 0
    try {
      const res = await fetch('/api/owner/scheduling-rules/generate', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: input.companyId,
          user_id: input.userId,
          date_from: input.dateFrom,
          date_to: input.dateTo,
          department_ids: input.departmentIds,
          shift_types: input.shiftTypes,
        }),
      })
      if (!res.body) throw new Error('Streaming not supported by this browser')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let doneResult: { notice?: string } | null = null
      let streamError: string | null = null

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sepIdx: number
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const rawEvent = buffer.slice(0, sepIdx)
          buffer = buffer.slice(sepIdx + 2)
          const eventMatch = rawEvent.match(/^event: (.+)$/m)
          const dataMatch = rawEvent.match(/^data: (.+)$/m)
          if (!eventMatch || !dataMatch) continue
          const eventName = eventMatch[1]
          const payload = JSON.parse(dataMatch[1])

          if (eventName === 'block') {
            expectedBlockCount = payload.expectedBlockCount ?? expectedBlockCount
            const block = payload.block as { department_id: string; department_name?: string; shift_date: string; slots: Omit<AiShiftSlot, 'key'>[]; warning: string | null }
            const deptName = block.department_name ?? departmentNames.get(block.department_id) ?? block.department_id
            received.push({
              key: `${block.department_id}_${block.shift_date}`,
              department_id: block.department_id,
              department_name: deptName,
              shift_date: block.shift_date,
              // Mint a stable id per slot here (the backend payload has none) — selection and
              // drag-reassign key off this instead of the slot's position in the array.
              slots: (Array.isArray(block.slots) ? block.slots : []).map(slot => ({ ...slot, key: crypto.randomUUID() })),
              warning: block.warning,
            })
            if (expectedBlockCount > 0) setState({ progress: Math.min(96, (received.length / expectedBlockCount) * 100) })
          } else if (eventName === 'done') {
            doneResult = payload
          } else if (eventName === 'error') {
            streamError = payload.message ?? 'Schedule generation failed'
          }
        }
      }

      if (streamError) throw new Error(streamError)

      const knownRows = new Map<string, AiScheduleKnownRow>()
      for (const block of received) {
        for (const slot of block.slots) {
          if (!slot.assigned_user_id) continue
          if (!knownRows.has(slot.assigned_user_id)) {
            knownRows.set(slot.assigned_user_id, { name: slot.assigned_user_name ?? '', deptId: block.department_id, deptName: block.department_name })
          }
        }
      }

      stopRuleStepTimer()
      setState({
        status: 'done',
        progress: 100,
        blocks: received,
        knownRows,
        // Slots with no assigned_user_id are "no eligible worker found" placeholders (rendered as
        // the red coverage-gap pill, not a real shift) — they must never enter the create payload,
        // or hard-rule validation checks a department+day that was never going to have a shift and
        // blocks the entire (otherwise valid) batch from saving.
        selected: new Set(received.flatMap(b => b.slots.flatMap(slot => slot.assigned_user_id ? [slot.key] : []))),
        notice: doneResult?.notice ?? `AI generated ${received.length} schedule block${received.length === 1 ? '' : 's'} for Owner review.`,
      })

      try {
        const contextRes = await fetch(`/api/owner/scheduling-rules/context?company_id=${input.companyId}&user_id=${input.userId}&date_from=${input.dateFrom}&date_to=${input.dateTo}`)
        const contextData = await contextRes.json()
        if (contextData.success) {
          const staff = contextData.context.staff as { id: string; fixed_off_days: string[]; leave_requests: { date: string | null; leave_type: string; status: string }[] }[]
          const nextAvailability = new Map<string, AiScheduleAvailability>()
          for (const member of staff) {
            nextAvailability.set(member.id, {
              fixedOffDates: new Set(member.fixed_off_days),
              approvedLeaveDates: new Set(member.leave_requests.filter(r => r.status === 'approved' && r.date).map(r => r.date as string)),
            })
          }
          setState({ staffAvailability: nextAvailability })
        } else {
          console.error('[AI Schedule] Failed to load staff availability for fixed-off/leave badges:', contextData.message)
        }
      } catch (err) {
        // Non-critical: the grid simply won't show fixed-off/leave badges if this lookup fails.
        console.error('[AI Schedule] Failed to load staff availability for fixed-off/leave badges:', err)
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      stopRuleStepTimer()
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Schedule generation failed' })
    } finally {
      if (abortController === controller) abortController = null
    }
  },
}
