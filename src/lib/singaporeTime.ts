// This app is Singapore-only (see company data, +65 phone numbers). shifts.shift_date/
// start_time/end_time and every "is this today" check that gates Clock In/Out are wall-clock
// values meant to represent Singapore local time — not UTC — but were historically parsed with
// a literal 'Z' (UTC) offset, while "today" was computed with a mix of the machine's own local
// timezone and true UTC. Both diverge from the intended Singapore day for roughly 8 hours around
// midnight SGT (see project memory module5-clockin-timezone-bug), making Clock In appear ~8
// hours late and letting a shift that's "today" only by real-UTC-date double up with the actual
// Singapore "today" in the Employee/Manager dashboard's My Shift card.
//
// Fix: always parse shift date+time against a fixed Singapore offset (+08:00, no DST) instead of
// 'Z', and always compute "today" as the Singapore calendar day, regardless of the server or
// browser's own timezone setting. Client-safe (no DB/HTTP), so both services/repositories and
// 'use client' components import from here.
const SGT_OFFSET = '+08:00'

// Combine a shift_date ('YYYY-MM-DD') and a wall-clock time ('HH:MM' or 'HH:MM:SS') into the
// real Singapore-time instant it represents.
export function sgtInstant(dateKey: string, time: string): Date {
  return new Date(`${dateKey}T${time}${SGT_OFFSET}`)
}

// Today's calendar date, as seen in Singapore time.
export function sgtTodayKey(): string {
  const nowInSgt = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return `${nowInSgt.getUTCFullYear()}-${String(nowInSgt.getUTCMonth() + 1).padStart(2, '0')}-${String(nowInSgt.getUTCDate()).padStart(2, '0')}`
}

// N days after the Singapore "today" calendar day, as a 'YYYY-MM-DD' key (N=0 is today itself).
export function sgtDateKeyPlusDays(days: number): string {
  const d = new Date(`${sgtTodayKey()}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// A real UTC-instant timestamp (e.g. attendance_records.clock_in_time/clock_out_time) -> the
// hour/minute it reads as on a Singapore wall clock. Unlike shift_date/start_time/end_time
// (already Singapore-nominal literal strings — see sgtInstant above), clock_in_time/clock_out_time
// are genuine UTC instants, so displaying them needs this +8h shift before reading hour/minute —
// reading their UTC getters directly (as some older formatting helpers did) shows a time 8 hours
// off from the real Singapore clock-in/out time.
export function sgtHourMinuteOfInstant(iso: string): { h: number; m: number } {
  const d = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000)
  return { h: d.getUTCHours(), m: d.getUTCMinutes() }
}

// Adds `days` calendar days to an arbitrary 'YYYY-MM-DD' key (unlike sgtDateKeyPlusDays, this is
// not relative to "today" — it walks a given date key forward/back, e.g. for resolving an
// overnight shift's end onto the following day).
export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// BUG-021: shifts have no separate end-date column — a shift is "overnight"/cross-midnight
// (e.g. 22:00-06:00) purely by convention: end_time at or before start_time means the shift ends
// on the FOLLOWING Singapore calendar day, not the same one. Every place that needs "when does
// this shift actually end" (clock-out gating, late/absent/overtime classification, clopening rest
// calculations, shift duration) must resolve the end through this helper instead of
// sgtInstant(shift_date, end_time) directly, or an overnight shift's end instant comes out earlier
// than its own start instant.
export function sgtShiftEndInstant(dateKey: string, startTime: string, endTime: string): Date {
  const endDateKey = endTime <= startTime ? addDaysToDateKey(dateKey, 1) : dateKey
  return sgtInstant(endDateKey, endTime)
}
