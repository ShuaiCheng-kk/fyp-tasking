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
