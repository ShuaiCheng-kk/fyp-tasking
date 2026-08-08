# Tasking Seed Script — User Manual

This is the guide for whoever needs to reset the test database and take screenshots of
the system with the fullest, most realistic data possible (Owner/Partner dashboards,
Shifts, Tasks, Attendance, Recruitment, Communication, Report — every module).

## ⚠️ Before you run anything

This script runs against the **real shared Supabase dev project** (not a local database).
Running it **wipes and rebuilds every company's business data** — shifts, tasks,
attendance, recruitment, communication, everything. If someone else is actively testing
against the same project when you run it, their in-progress data will disappear.
**Check with the team before running it if you're not sure you're the only one using the
dev environment right now.**

`seed.js` is the only database seed script in this folder — it wipes everything and
rebuilds a full realistic demo company.

## How to run it

```
cd fyp-tasking
node scripts/seed.js
```

Takes a minute or two. When it finishes it prints a full summary of everything it
created. If you see `EXIT` with no `⚠` warning lines, it ran clean.

Password for **every** account below is `111111`.

## Accounts

### Company roles (Sunrise Hospitality Group, Paid plan)

| Role | Email | Name |
|---|---|---|
| Owner | `owner@test.com` | Sarah Mitchell |
| Partner | `partner1@test.com` | James Tan |

Departments each have **2 Managers + 2 Employees**:

| Department | Manager 1 | Manager 2 | Employee 1 | Employee 2 |
|---|---|---|---|---|
| Operations | `manager1@test.com` David Lim | `manager5@test.com` Wendy Ho | `employee1@test.com` Ben Seah | `employee5@test.com` Grace Lim |
| Marketing | `manager2@test.com` Rachel Koh | `manager6@test.com` Kelvin Ang | `employee2@test.com` Chloe Yeo | `employee6@test.com` Hannah Lee |
| Engineering | `manager3@test.com` Aaron Wong | `manager7@test.com` Natalie Goh | `employee3@test.com` Daniel Tay | `employee7@test.com` Ivan Koh |
| Customer Support | `manager4@test.com` Fiona Chen | `manager8@test.com` Samuel Ng | `employee4@test.com` Elaine Chua | `employee8@test.com` Sophia Tan |

Casual Workers (mostly Operations, two also cover a second department):

| Email | Name | Departments |
|---|---|---|
| `casual1@test.com` | Marcus Lee | Operations — has a "right now" clockable Shift job, full Clock In→Break→Clock Out flow |
| `casual2@test.com` | Farah Aziz | Marketing |
| `casual3@test.com` | Priya Nair | Operations |
| `casual4@test.com` | Daniel Wong | Operations |
| `casual5@test.com` | Hafiz Rahman | Operations + Engineering |
| `casual6@test.com` | Marcus Tan | Operations + Customer Support |
| `casual7@test.com` | Nadia Osman | Operations |
| `casual8@test.com` | Hana Bakri | Operations — separate "right now" Shift-job demo |

Guests (public job-board applicants, not employed): `guest1@test.com` … `guest5@test.com`.

### Platform-level accounts (not company-scoped, survive every reset)

| Role | Email |
|---|---|
| Marketing Admin | `madmin@tasking.com` |
| User Admin | `uadmin@tasking.com` |

## Where to look for the fullest picture

**Owner and Partner see everything, so start there** — they're the most complete view.
Manager/Employee pages reuse the same shared components but scoped to their own
department.

- **Dashboard** — all "Waiting On You" cards and Overview panels populated.
- **Shifts → Schedule** — every department has its own hours (Manager's window starts
  earlier / ends later than Employee's), a realistic 2-day-off weekly rest pattern (not
  everyone working every day), and 4 **Split Shift** examples (one per department — look
  for a shift split into two time blocks with a gap).
- **Shifts → Swap Requests** — several pending requests across departments, each with a
  real task attached ("Current Task Assignment" / "Task Assignment After Swap" aren't
  empty), Completed Requests shows both Approved and Rejected examples with the
  "Approved/Rejected by X" badge (click it to see the reason).
- **Tasks** — Kanban has all 4 statuses + Rework badges (one per department) + several
  Archived tasks + a full Deadline Calendar (every day this week and next has tasks
  across multiple departments, Overdue items cluster in just the last 3 days).
- **Attendance → Records** — Present/Late/Absent/Modified all represented, including for
  Casual Workers; nothing shows a future clock-out.
- **Attendance → Off Day** — pending requests across all 4 departments, plus one
  "Modified" completed example.
- **Team/Company** — Casual Workers panel populated, **Activity Log** has real entries
  (invites, department changes, activate/deactivate).
- **Recruitment** — 6 postings covering every status (Open/Pending Approval/Draft/
  Rejected/Archived/Closed), Guest applicants covering every application state.
- **Communication** — Owner's own Chat has 6 conversation threads, 5 Owner-authored
  Announcements.
- **Report** — every chart (On-time Attendance, Task Completion, Casual Worker Cost
  Distribution, Hiring, Time to Fill) has a bar/slice for **all 4 departments**, not just
  1–2.

**Manager** (`manager1@test.com` is the most fleshed-out example) — same Shifts/Tasks/
Attendance pages scoped to Operations, plus their own **Swap Requests** review queue
(5 pending Employee-tier swaps to approve/reject) and a **My Requests** panel to submit
their own swap/off-day requests.

**Casual Worker** (`casual1@test.com`) — Dashboard has a live, immediately-clockable
Shift job (Clock In → Break In → Break Out → Clock Out, no supervisor approval needed),
Upcoming Jobs filled for the week, Applications page covers Accept/Reject Offer +
History states.

## Things to know before you screenshot

- **Data dates shift forward every time you re-run the script** — it's always built
  relative to "today," so if your teammate runs it next week the same *pattern* holds
  (same account structure, same variety) but the actual calendar dates will differ from
  today's screenshots. That's expected, not a bug.
- **A few shifts are "live" and change every run** — Marcus Lee's, Hana Bakri's,
  manager1's (David Lim), and employee1's (Ben Seah) demo shifts are always computed as
  "right now," so exact times differ run to run. This is intentional — it's what makes
  Clock In/Clock Out immediately clickable right after the script finishes.
- **Once someone clocks all the way out for the day, their "Submit Request" button locks
  site-wide** (Dashboard/Tasks/Shifts/Communication go read-only) until their next Clock
  In. If you need to demo *submitting* a new Shift Swap or Off Day request, do that
  **before** clicking Clock Out on that account — or just re-run `seed.js` again, which
  wipes attendance records and clears the lock.
- **Marketing site content** (what `madmin@tasking.com` edits) is **not** touched by
  `seed.js` at all — it's a separate system. If that ever shows up empty, run
  `node scripts/seed-marketing-pages.mjs` — it's a full idempotent snapshot of every
  marketing page and content block, regenerated from the live database after each content
  change, so it alone restores everything (no other scripts needed).

## If something looks wrong

If a page looks empty or broken after running `seed.js`, check the terminal output first
— any row it failed to create prints a `⚠` warning with the reason. If it ran with zero
warnings and something still looks off, that's worth flagging as a real bug rather than
a data problem.
