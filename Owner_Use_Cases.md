# Tasking — Owner Role: Complete Use Cases (UC-01 → UC-52)

> Owner is the highest-privilege superset role. **"Owner's full feature set" = the full internal system.** Every other internal role (Partner, Manager, Employee) is built by removing features and narrowing scope from this list. Build Owner first, then trim.
>
> Status legend: **[DONE]** = already built · **[TODO]** = to build.
> AI features are built manual-first behind a service function, then the AI API swaps in. AI is limited to the four marked *(AI feature)*.

---

## Module 1 — Dashboard (main feature: Smart Task Allocation)

The Dashboard is the command centre. Its core is one large **Allocation Timeline** showing everyone's shifts and tasks across all departments. Existing department-management widgets live on this same page.

---

### UC-01 — Dashboard: Manage Departments  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Create, rename, and delete departments in the active company |
| Actions | Add department · Edit department name · Delete department |
| Notes | Departments shown as cards with a search/filter bar |

---

### UC-02 — Dashboard: Generate Invitation Codes  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Onboard new team members via a shareable invitation code |
| Actions | Generate code for Owner, Manager, or Employee role · Select target department (required for Manager/Employee) · Copy invite link to clipboard |

---

### UC-03 — Dashboard: Assign Manager to Department  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Set or change which Manager leads a given department |
| Actions | Click a department card · Select a Manager from the company roster · Save assignment |

---

### UC-04 — Dashboard: Switch Active Company  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Switch context between multiple owned companies |
| Actions | Click the company name dropdown in the top bar · Select a different company |
| Notes | Only visible when the Owner belongs to more than one company |

---

### UC-21 — Dashboard: View Allocation Timeline  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | See, on one timeline, every person's shifts and tasks across all departments — the single command-centre view |
| Actions | View one day split into two strips (00:00–12:00 on top, 12:00–24:00 below) · Each row = a person (Manager / Employee / Casual Worker) showing their shift blocks with department, name, and time · Click a shift to see its assigned tasks |
| Notes | Owner sees ALL departments and everyone under each Manager. This page must visibly demonstrate the "smart task allocation" theme. |

---

### UC-22 — Dashboard: Navigate Timeline Dates  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Move the timeline across days and weeks |
| Actions | Slide / click arrows to move between days · Jump to "Today" · View the week ahead |
| Rules | History limited to 2 days back (yesterday, day before); forward view extends through next week |

---

### UC-23 — Dashboard: Create / Edit / Delete Shift  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Schedule when a person works |
| Actions | Click an empty slot on the timeline · Set department, person, start/end time · Edit by clicking a shift or dragging it · Delete with confirm |
| Notes | Shifts apply to Managers, Employees, and Casual Workers alike |

---

### UC-24 — Dashboard: Assign Task on a Shift  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Tell a person what to do during their shift |
| Actions | Click a person's shift on the timeline · Click "Add Task" · Enter title, description, priority · Assign · Person is notified |
| Rules | Tasks are assigned strictly one level down (Owner → Manager). Owner inherits lower levels, so can act down the chain, but the default target is the next level. |

---

### UC-25 — Dashboard: View Who's Doing What  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | See, for any person, the tasks assigned within their current shift |
| Actions | Expand a Manager to see their Employees · Expand a shift to see its tasks, each task's status (Todo / In Progress / Done) and a **percent-complete progress bar** · A shift/person shows overall completion rolled up from its tasks |

---

### UC-26 — Dashboard: Edit / Delete / Duplicate Task & Sub-task  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Maintain tasks after assignment |
| Actions | Open a task · Edit fields / Delete / Duplicate · Add sub-tasks · Set recurrence for routine tasks |

---

### UC-27 — Dashboard: Publish / Unpublish Schedule  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Make draft shifts visible to workers, or pull them back |
| Actions | Click "Publish" on a day/week of draft shifts · Workers are notified · Click "Unpublish" to revert to Draft |
| Notes | Only Published shifts can be accepted/rejected by workers |

---

### UC-28 — Dashboard: Set Recurring / Duplicate Shift  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Repeat or copy a shift without recreating it |
| Actions | Open a shift · Set recurrence (daily / weekly / custom) with an end date, OR duplicate to a new date/time · Save |

---

### UC-29 — Dashboard: Set Shift Acceptance Deadline  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Require workers to respond to a shift within a set window |
| Actions | Open a shift · Set "respond by" date/time · Save · Unresponded shifts are flagged after the deadline |

---

### UC-30 — Dashboard: Detect Clopening Conflict  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Be warned when a worker is scheduled back-to-back with too little rest |
| Actions | System checks rest gap on assignment · Shows a warning on the conflicting shift · Owner can override or reschedule |
| Notes | Manual rule-based check; precursor to AI Anomaly Detection (UC-49) |

---

### UC-31 — Dashboard: View Split Shift Timeline  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | See a worker's full day at a glance when they work multiple split shifts |
| Actions | Select a worker · View all their shifts on the day's two-strip view · See gaps |

---

### UC-32 — Dashboard: Undo Last Action  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Reverse an accidental scheduling change quickly |
| Actions | Click "Undo" after a create/edit/delete/assign action |

---

### UC-33 — Dashboard: Import Departments from File  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Create many departments at once from a file |
| Actions | Click "Import Departments" · Upload a file listing department names · System reads and creates them directly |
| Rules | **No emails are sent** — departments are data, not people. This differs from importing team members (UC-37), which sends invitations. |

---

## Module 2 — Report

### UC-48 — Report: View Workforce Analytics  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Get a data-driven summary of workforce and operations |
| Actions | See a **status overview of all shifts and tasks** (how many Todo / In Progress / Done, completion %), **attendance summary** (present / late / absent / pending approval), **hours worked** shown as a bar chart, and **department utilisation** · Surface pressing issues / anomalies (uncovered shifts, overdue tasks, flagged attendance) · Filter by date range / department · Export |
| Notes | Report = a roll-up of existing shift / task / attendance data (no new data needed). Build the structure now; it fills as data grows. Inspired by a status-overview dashboard: progress at a glance + risks highlighted. |

---

## Module 3 — Team

### UC-05 — Team: View Team Members  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Browse all members in the current company grouped by role |
| Actions | View members grouped by role (Owner / Partner / Manager / Employee / Casual Worker) · Each member shown as a row with name, role/position, department, email, and a **task-completion / hours progress indicator** · Click a member to open their detail (their shifts, tasks, completion) · Existing actions (remove, change department, change manager) available from the row's "..." menu |
| Notes | Per-person rows with a completion bar (inspired by a Users list view), upgrading the current name+email-only display. |

---

### UC-06 — Team: Remove Team Member  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Remove a member from the company |
| Actions | Click "Remove" on a member · Confirm in modal |
| Rules | Cannot remove self · Cannot remove the company creator |

---

### UC-07 — Team: Change Member's Department  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Reassign a member to a different department |
| Actions | Open change-department modal · Select new department · Save |

---

### UC-08 — Team: Change Member's Reporting Manager  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Update which Manager a member reports to |
| Actions | Open edit-manager modal · Select new manager · Save |

---

### UC-37 — Team: Import Members from File  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Invite many team members at once from a file |
| Actions | Click "Import Members" · Upload a file with each person's target role and email · System reads it and automatically sends an invitation email to each |
| Rules | **Emails ARE sent** — members are people who must accept an invite to join. This differs from importing departments (UC-33), which sends nothing. |

---

## Module 4 — Communication (Announcements + Messages, two tabs)

> Announcements (broadcast) and Messages (one-to-one) are merged into one sidebar module with two tabs, to keep the sidebar uncluttered.

### UC-09 — Communication: Post Announcement  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Broadcast a message to the whole company or a specific department |
| Actions | Click "New" · Enter title and content · Choose audience (Company-wide or specific department) · Post |

---

### UC-10 — Communication: Read Announcement  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Read company/department announcements |
| Actions | Select an announcement · Content shown in detail panel · Unread dot clears on open |

---

### UC-11 — Communication: Edit Own Announcement  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Correct or update a previously posted announcement |
| Actions | Select own announcement · Click "Edit" · Modify title, content, or audience · Save |
| Rules | Only the original poster sees Edit/Delete |

---

### UC-12 — Communication: Delete Own Announcement  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Remove a previously posted announcement |
| Actions | Select own announcement · Click "Delete" · Confirm in dialog |

---

### UC-13 — Communication: Send Direct Message  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Have a private conversation with a team member |
| Actions | Click "New Message" · Search and select recipient · Type and send · Real-time via Supabase subscription |
| Rules | Cannot message Casual Workers |

---

## Module 5 — Inbox

### UC-14 — Inbox: Accept / Decline Company Invitation  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Join or reject an invitation to become an Owner in another company |
| Actions | Open "Invitations" tab · Click Accept or Decline on a pending invite |

---

## Module 6 — Recruitment

> Owner can post jobs and review applicants. Manager inherits this exact logic. Posted jobs appear on the public Job Board on the marketing site.

### UC-39 — Recruitment: Post Job Opening  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Advertise a role so Casual Workers / Guests can apply |
| Actions | Click "New Job" · Enter title, department, type, location, pay, dates, description · Publish to the public Job Board |

---

### UC-40 — Recruitment: Edit / Archive / Duplicate Job Opening  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Maintain job postings |
| Actions | Open a posting · Edit fields · Archive a filled posting · Duplicate for a similar role |

---

### UC-41 — Recruitment: View Applicant List  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Review who applied to a job opening |
| Actions | Open a posting · View applicants with profile, skills, availability · Sort / filter |

---

### UC-42 — Recruitment: Accept / Reject Applicant  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Hire or decline an applicant |
| Actions | Select an applicant · Accept (sends a job invitation; on confirm they become an active Casual Worker) or Reject |

---

### UC-43 — Recruitment: Set Casual Worker Inactive / Blocked  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Temporarily or permanently stop a worker from being scheduled |
| Actions | Open a worker · Set Inactive (cannot apply) or Blocked (cannot re-enter) |

---

## Module 7 — Attendance

> Approval is a 4-tier chain: Casual Worker clocks in/out → supervising **Employee** confirms → **Manager** reviews → **Owner** gives final approval (Owner controls pay). Each tier can approve, reject, or send back.

### UC-44 — Attendance: Final Approve / Reject / Modify Record  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Give the final decision on attendance/timesheets that Managers have already reviewed |
| Actions | Open the Manager-reviewed queue · See worked hours visualised as a **bar chart** per worker/shift alongside the record · **Quickly review and approve/reject** in one place · Approve (final) · Reject with reason · Modify (original preserved as history) |
| Rules | Records reach Owner only after Employee confirm + Manager review. Owner's approval is final and triggers pay readiness. |

---

### UC-45 — Attendance: Track Status & Flag No-shows / Late / Overtime  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Monitor real-time attendance and exceptions |
| Actions | View who is clocked in / late / absent · System flags no-shows, late arrivals, overtime against scheduled shift times |

---

### UC-46 — Attendance: Manage Time-off & Break-waiver Requests  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Approve or reject staff time-off and break-waiver requests |
| Actions | Open requests queue · Approve / reject each · Approved time-off blocks scheduling in that window |

---

### UC-47 — Attendance: Approve Shift Swap Request  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Allow workers to trade shifts with approval |
| Actions | Open a swap request · Review both workers' eligibility · Approve / reject |

---

## Module 8 — Settings

### UC-15 — Settings: Edit Company Profile  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner (company creator only) |
| Goal | Update company information |
| Actions | Click "Edit" on a company card · Modify name, description, location, industry, size · Save |

---

### UC-16 — Settings: Create Additional Company  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Register a new company under the same account |
| Actions | Click "Add Company" · Fill in name, location, industry, size, optional departments · Create |

---

### UC-17 — Settings: Delete Company  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner (company creator only) |
| Goal | Permanently remove a company |
| Actions | Click "Delete" on a company card · Confirm in modal |

---

### UC-18 — Settings: Manage Subscription Plan  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Upgrade or downgrade the company's subscription tier |
| Actions | Switch to "Subscription" tab · Click Upgrade or Downgrade on the target company |

---

### UC-19 — Settings: Leave Company  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner (non-creator only) |
| Goal | Exit a company the Owner was invited into but did not create |
| Actions | Click "Leave Company" on the company card · Confirm |
| Notes | If it is the last company, the account is permanently deleted |

---

### UC-20 — Logout  **[DONE]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Sign out of the application |
| Actions | Click "Logout" in the sidebar |

---

## Module 9 — AI Features (free tier; built manual-first behind a service function)

### UC-49 — AI: Anomaly Detection  *(AI feature)*  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Be alerted automatically to unusual attendance / scheduling patterns |
| Actions | System surfaces anomalies on the Timeline & Report · Owner reviews each |
| Notes | Manual rule-based version first; AI swaps in via API later. |

---

### UC-50 — AI: Auto-approve Timesheets  *(AI feature)*  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Only review flagged timesheets; let clean ones auto-approve |
| Actions | Enable auto-approve · System approves records matching the shift · Flags mismatches for manual review |
| Notes | Manual-first behind a service function; AI swaps in later. Fits the 4-tier chain at the Owner tier. |

---

### UC-51 — AI: Candidate Recommendation  *(AI feature)*  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Quickly identify the most suitable applicants for a posting |
| Actions | Open a posting's applicant list · View AI-ranked candidates by skills / availability match · Owner makes the final pick |
| Notes | Manual scoring first; AI swaps in later. |

---

### UC-52 — AI: Job Description Generator  *(AI feature)*  **[TODO]**

| Field | Detail |
|-------|--------|
| Actor | Owner |
| Goal | Produce a job description without writing it by hand |
| Actions | In the New Job form, click "Generate" · Enter role + key points · System drafts the description · Owner edits and uses it |
| Notes | Template first; AI swaps in later. |

---

## Summary

- **Done (20):** UC-01–20 — auth, company/department management, team, communication, inbox, settings.
- **To build (32):** UC-21–33, 37, 39–52 — the Dashboard Timeline + task allocation, file imports, Recruitment, Attendance (4-tier), Report, and the 4 AI features.
- Owner = full internal superset. Partner = Owner minus "delete invited company". Manager = scoped to own department(s). Employee = own shifts/tasks + supervise CWs. Build Owner, then trim downward.
