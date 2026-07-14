// Classifies a Guest User's application into where it sits on the 3-step hiring journey, or
// flags it as a "terminal" outcome that fell off that path entirely.
//
// Only 3 steps: the Applications page only ever shows jobs the worker has ALREADY applied to
// (there's no "Apply" step to track — every application here has cleared that by definition).
//   1. Pending Review — the employer hasn't decided yet
//   2. Accept/Reject Job Offer — the employer accepted; now it's the worker's turn to confirm
//   3. Confirmed — both sides agreed, the job is locked in
//
// The Applications page renders each step as its own block (a job's card lives in whichever
// block matches its current step), so there's no separate stepper widget here — this module is
// just the classification logic + the step labels those blocks are titled with.

export const FLOW_STEPS: string[] = ['Pending Review', 'Accept / Reject Job Offer', 'Confirmed']

export type FlowTone = 'success' | 'danger' | 'neutral' | 'warning'

export type FlowState =
  | { kind: 'stepper'; step: number }
  | { kind: 'terminal'; tone: FlowTone; title: string; message: string }

// Minimal shape needed to classify — matches the fields already on the Applications page's
// Application type.
type FlowInput = {
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'cancelled_by_employer' | 'job_closed'
  invitation_status?: 'sent' | 'accepted' | 'declined' | 'expired' | 'position_filled' | 'cancelled' | null
}

export function getApplicationFlowState(app: FlowInput): FlowState {
  // Outcomes the worker never sees — the service filters these out before they reach the page, so
  // these branches are purely defensive: they keep a stray row out of the Ongoing buckets and
  // never actually render a badge. Each one was already communicated by email, or was the
  // worker's own doing:
  //   • withdrawn            — they walked away (withdrew / declined an offer / cancelled a shift)
  //   • expired              — never confirmed an offer before the shift began (they were emailed it)
  //   • cancelled_by_employer — removed from a confirmed job (they were emailed the cancellation)
  if (app.status === 'withdrawn') {
    return { kind: 'terminal', tone: 'neutral', title: 'Withdrawn', message: 'You withdrew this application.' }
  }
  if (app.invitation_status === 'expired') {
    return { kind: 'terminal', tone: 'neutral', title: 'Offer Expired', message: 'This offer expired — the shift started before it was confirmed.' }
  }
  if (app.status === 'cancelled_by_employer') {
    return { kind: 'terminal', tone: 'neutral', title: 'Cancelled', message: 'This confirmed job was cancelled by the employer.' }
  }

  // The one outcome History actually shows — the worker simply didn't get the job, whether the
  // employer passed on them, the role filled up, or the posting closed first. The fine-grained
  // backend reasons don't help the worker, so they're collapsed into a single label.
  if (app.status === 'rejected' || app.invitation_status === 'position_filled' || app.status === 'job_closed') {
    return { kind: 'terminal', tone: 'neutral', title: 'Not Selected', message: 'You were not selected for this job.' }
  }

  // On the happy path — map to one of the 3 steps.
  if (app.invitation_status === 'accepted') return { kind: 'stepper', step: 3 }
  if (app.invitation_status === 'sent') return { kind: 'stepper', step: 2 }
  if (app.status === 'accepted') return { kind: 'stepper', step: 2 } // fallback: invitation not loaded yet
  return { kind: 'stepper', step: 1 }
}
