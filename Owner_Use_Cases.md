# Tasking - Owner Superset Use Cases (UC-01 to UC-52)

> Tasking is a Smart Task Allocation application. Owner is the full internal-system superset. Partner, Manager, and Employee screens should be derived by narrowing scope and removing privileges from Owner, not by inventing separate logic.
>
> This document is used for two purposes:
> 1. Preliminary Technical Manual diagrams: choose high-relevance use cases and draw target MVC + Repository class diagrams and sequence diagrams.
> 2. Development: implement each use case through the strict layer flow below.

---

## Architecture Rule For Every Use Case

Every implemented use case must follow:

```text
page.tsx -> route.ts -> service -> repository -> Supabase table
```

- `page.tsx`: UI only. Calls API routes. No direct service, repository, or Supabase access.
- `route.ts`: Controller only. Parses request, validates required fields, calls service, returns response.
- `service.ts`: Business logic only. No HTTP and no direct Supabase calls.
- `repository.ts`: Database access only. Supabase queries only, no business rules.
- `types/`: Explicit TypeScript interfaces for entities used in diagrams and code.

Do not draw or implement:

```text
page -> repository
page -> Supabase
route -> Supabase
service -> HTTP response
```

---

## Diagram Priority Legend

Use this to decide what to draw first.

- **P1 Core Diagram**: strongly connected to Smart Task Allocation. Draw MVC class diagram + sequence diagram.
- **P2 Support Diagram**: useful for system completeness, but not the main theme. Draw only if time allows.
- **P3 Context Only**: supporting/admin/auth feature. Mention in manual, diagram optional.

## Smart Allocation Relevance

- **Core**: directly about shifts, tasks, allocation, attendance execution, anomaly/reporting.
- **Related**: supports the core flow, for example team setup or recruitment pool.
- **Support**: system/admin/communication feature, not central to the project title.

## Numbering Note

The project numbering runs from UC-01 to UC-52, but the current use-case list defines 48 concrete use cases. UC-34, UC-35, UC-36, and UC-38 are reserved / not currently defined in the project scope. Do not create diagrams for those reserved numbers unless the team later adds official use cases for them.

---

## Recommended Diagrams For Preliminary Technical Manual

If the team cannot draw all diagrams, start with these:

1. UC-21 View Allocation Timeline
2. UC-23 Create / Edit / Delete Shift
3. UC-24 Assign Task on a Shift
4. UC-25 View Who Is Doing What
5. UC-27 Publish / Unpublish Schedule
6. UC-29 Shift Acceptance Deadline
7. UC-30 Clopening Conflict Detection
8. UC-44 Attendance Final Approval
9. UC-45 Track Late / Absent / Overtime
10. UC-48 Workforce Analytics Report
11. UC-49 AI Anomaly Detection

For preliminary submission, diagrams may represent target design. For final submission, diagrams must be updated to match final code names, API routes, service methods, repository methods, and tables.

---

# Module 1 - Dashboard

The Dashboard is the command centre. It contains the Allocation Timeline, shift controls, task allocation controls, and operational warnings.

---

## UC-01 - Dashboard: Manage Departments

| Field | Detail |
|---|---|
| Status | Built / needs regression testing |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Related |
| Diagram Priority | P3 Context Only |
| Goal | Create, rename, and delete departments in the active company. Departments are the grouping unit for managers, employees, casual workers, shifts, tasks, and reports. |
| User Actions | Add department. Rename department. Delete department after confirmation. |
| MVC / Repository Slice | `OwnerDashboardPage` -> department API route -> company/team service -> company/team repository -> `departments` table. |
| Sequence Focus | Owner submits department name, controller validates, service checks business rule, repository writes `departments`, dashboard refreshes department cards. |
| Developer Notes | Do not send emails for department creation. Importing departments is separate from importing members. |

---

## UC-02 - Dashboard / Team: Generate Invitation Codes or Send Invite

| Field | Detail |
|---|---|
| Status | Built / moved toward Team page |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Invite internal users into the company with the correct role and optional department. |
| User Actions | Enter email. Select role. Select department when role is Manager or Employee. Send invite. |
| MVC / Repository Slice | `OwnerTeamPage` -> invitation API route -> invitation service -> invitation repository + email service -> `invitation_code`, `users`, `companies`, email provider. |
| Sequence Focus | UI posts invite request, controller validates fields, service creates invitation code and email link, repository stores code, email service sends invite. |
| Developer Notes | Manager/Employee code is 5-digit numeric. Owner/Partner code is 8-character alphanumeric. Existing users should receive inbox notifications for later company invites. |

---

## UC-03 - Dashboard: Assign Manager to Department

| Field | Detail |
|---|---|
| Status | Built / currently being tested |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Set the primary Manager for a department so allocation responsibility is clear. |
| User Actions | Open department card. Choose manager. Save assignment. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/team/department-manager` -> `ownerTeamService.setDepartmentManager` -> `ownerTeamRepository` -> `manager_departments`, `users`. |
| Sequence Focus | Owner selects manager, service validates manager belongs to company, repository updates manager department membership, dashboard refreshes cards. |
| Developer Notes | The manager's `users.department_id` must stay consistent with `manager_departments`. A Manager should not visually remain in the old department after reassignment. |

---

## UC-04 - Dashboard: Switch Active Company

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Switch the active company context when a user belongs to more than one company. |
| User Actions | Open company dropdown. Select another company. |
| MVC / Repository Slice | `OwnerDashboardPage` -> company current API -> company service/repository -> `companies`, `company_members`. |
| Sequence Focus | Page stores selected company id in local storage and reloads company-scoped data. |
| Developer Notes | Every company-scoped API must receive `company_id` from current context. |

---

## UC-21 - Dashboard: View Allocation Timeline

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Show all relevant people and their shifts in a single command-centre timeline. |
| User Actions | Open Dashboard. View shift blocks grouped by person and department. Click a shift to inspect details. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/shift` -> `shiftService.getTimelineShifts` -> `shiftRepository` -> `shifts`, `shift_assignments`, `users`, `departments`, `company_members`. |
| Sequence Focus | Page requests date range, service loads shifts and assignments, service groups data into `TimelineRow`, page renders rows and shift blocks. |
| Developer Notes | Scope differs by role: Owner/Partner see all company data, Manager sees assigned departments, Employee/Casual Worker see own shifts. The same pattern can be reused with narrowed service filters. |

---

## UC-22 - Dashboard: Navigate Timeline Dates

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P2 Support Diagram |
| Goal | Move timeline view across allowed dates. |
| User Actions | Previous day. Today. Next day. Date picker if implemented. |
| MVC / Repository Slice | `DashboardPage` state -> `/api/shift` -> `shiftService.getTimelineShifts` -> `shiftRepository.getShiftsByCompanyAndDateRange`. |
| Sequence Focus | User changes date, page calls shift API with new date range, service returns timeline rows for that date. |
| Developer Notes | Allowed range: up to 2 days back and forward through next week. Do not create shifts from empty timeline slots in final design; create shifts from department/member assignment controls. |

---

## UC-23 - Dashboard: Create / Edit / Delete Shift

| Field | Detail |
|---|---|
| Status | Built / currently being tested |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Create, update, and remove work shifts for schedulable users. |
| User Actions | Assign shift from department/member card. Edit shift by clicking timeline block. Delete shift with confirmation. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/shift` or `/api/shift/[id]` -> `shiftService.createShift/editShift/deleteShift` -> `shiftRepository` -> `shifts`, `shift_assignments`. |
| Sequence Focus | Owner submits shift form, service validates time and deadline, repository inserts shift, repository inserts assignment, dashboard refreshes timeline. |
| Developer Notes | `shifts` has no `assigned_user_id`. Assignment belongs in `shift_assignments`. `created_by` and `assigned_by` must be internal `users.id`, not Supabase Auth id. |

---

## UC-24 - Dashboard / Tasks: Assign Task on a Shift

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Assign work to the correct lower role during a shift. |
| User Actions | Select shift. Add task. Enter title, description, priority, due date. Assign to valid target. |
| MVC / Repository Slice | `OwnerTasksPage` -> `/api/task` -> `taskService.assignTask` -> `taskRepository` -> `tasks`, `shifts`, `users`. |
| Sequence Focus | Page posts task, service validates assignment rule and shift ownership, repository inserts `tasks`, page refreshes kanban/task list. |
| Developer Notes | Assignment chain: Owner -> Manager, Manager -> Employee, Employee -> Casual Worker. Owner implementation currently focuses on Manager assignment. |

---

## UC-25 - Dashboard / Tasks: View Who Is Doing What

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | See task ownership, status, and progress for each person and shift. |
| User Actions | Open tasks page or shift detail. View status columns, assignee, shift link, progress percentage, and subtasks. |
| MVC / Repository Slice | `OwnerTasksPage` / `OwnerDashboardPage` -> `/api/task?kanban=true` or `/api/task?shift_id=X` -> `taskService.getKanbanTasks/getTasksByCompanyShift` -> `taskRepository` -> `tasks`. |
| Sequence Focus | Page requests task groups or shift-specific tasks, service filters/groups data, page displays status, assignee, shift link, progress percentage, and subtasks. |
| Developer Notes | Dashboard shift detail now shows linked tasks from the timeline. Progress roll-up is calculated from task percentages. |

---

## UC-26 - Dashboard / Tasks: Edit / Delete / Duplicate Task and Sub-task

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Core |
| Diagram Priority | P2 Support Diagram |
| Goal | Maintain task details after allocation. |
| User Actions | Open task. Edit status, progress, priority, due date, assignee, shift. Delete task. Add sub-task. Duplicate task and its direct sub-tasks. |
| MVC / Repository Slice | `OwnerTasksPage` -> `/api/task` PATCH/DELETE/POST -> `taskService.editTask/deleteTask/assignTask/duplicateTask` -> `taskRepository` -> `tasks`. |
| Sequence Focus | User edits, deletes, creates sub-task, or duplicates task; controller parses request; service validates and handles sub-task rules; repository updates task rows; page refreshes. |
| Developer Notes | Sub-tasks use `tasks.parent_task_id`. Deleting parent tasks deletes direct sub-tasks first to avoid FK failures. |

---

## UC-27 - Dashboard: Publish / Unpublish Schedule

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Control whether draft shifts are visible/actionable to workers. |
| User Actions | Publish or unpublish a day/week schedule. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/shift/schedule` -> `shiftService.publishSchedule` -> `shiftRepository.updateSchedulePublication` -> `shifts.publication_status`. |
| Sequence Focus | User clicks Publish, controller validates range, service validates status/date range, repository updates shifts, timeline refreshes. |
| Developer Notes | Only published shifts should be accept/reject eligible for lower roles. New duplicated/recurring shifts should default to draft. |

---

## UC-28 - Dashboard: Set Recurring / Duplicate Shift

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Repeat or copy shifts without recreating the same details manually. |
| User Actions | Open shift. Duplicate to another date/time or create recurring shifts until an end date. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/shift/[id]/duplicate` or `/api/shift/[id]/recurrence` -> `shiftService.duplicateShift/createRecurringShifts` -> `shiftRepository` -> `shifts`, `shift_assignments`. |
| Sequence Focus | Service loads original shift and assignment, creates new draft shifts, copies assignment when appropriate, timeline refreshes. |
| Developer Notes | Recurrence supports daily, weekly, custom interval. Limit generated instances to avoid runaway inserts. |

---

## UC-29 - Dashboard: Set Shift Acceptance Deadline

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Require assigned workers to respond before a deadline. |
| User Actions | Set respond-by date/time on shift. Published shift becomes late/flagged if still unresponded after deadline. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/shift/[id]` -> `shiftService.editShift` -> `shiftRepository.updateShift` -> `shifts.acceptance_deadline_at`, `shift_assignments.assignment_status`. |
| Sequence Focus | User saves deadline, service validates deadline before shift start, repository updates shift, timeline marks overdue assigned shifts. |
| Developer Notes | Lower-role accept/reject route still needs implementation. Current Owner timeline can visually flag overdue assigned shifts. |

---

## UC-30 - Dashboard: Detect Clopening Conflict

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Warn when a worker is scheduled with too little rest between closing and opening shifts. |
| User Actions | Create/edit shift. System checks previous and next shifts for same user. Owner/Manager can reschedule or override if allowed. |
| MVC / Repository Slice | `DashboardPage` -> shift API -> `shiftService.detectClopeningConflict` -> `shiftRepository.getAssignmentsByUserAndDateRange` -> `shifts`, `shift_assignments`. |
| Sequence Focus | Before insert/update, service fetches nearby assigned shifts, calculates rest gap, returns warning or blocks based on rule. |
| Developer Notes | Manual rule first. This is a precursor to AI anomaly detection. Keep detection logic in service, not UI. |

---

## UC-31 - Dashboard: View Split Shift Timeline

| Field | Detail |
|---|---|
| Status | Built / needs UI testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P2 Support Diagram |
| Goal | Show workers with multiple shifts in one day clearly, including gaps. |
| User Actions | Select date/person. View multiple shift blocks and gaps. |
| MVC / Repository Slice | `DashboardPage` -> `/api/shift` -> `shiftService.getTimelineShifts` -> `shiftRepository` -> timeline data. |
| Sequence Focus | Page loads all shifts for a date, groups by person, renders multiple blocks in the same row. |
| Developer Notes | AGENTS says day view should be two strips: 07:00-15:00 and 15:00-23:00. Current UI may need refinement to match this. |

---

## UC-32 - Dashboard: Undo Last Action

| Field | Detail |
|---|---|
| Status | Built / needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P2 Support Diagram |
| Goal | Reverse accidental shift/task allocation actions quickly. |
| User Actions | After create/edit/delete/assign, click Undo. |
| MVC / Repository Slice | `OwnerDashboardPage` -> `/api/shift/undo` -> `shiftService.undoLastShiftAction` -> `shiftRepository` -> `shift_action_history`, `shifts`, `shift_assignments`. |
| Sequence Focus | Shift service stores action snapshot before/after mutation. Undo reads last reversible action for the actor and restores or removes shift data. |
| Developer Notes | Requires `shift_action_history` migration. Current implementation covers shift create/edit/delete/assign actions. Do not fake undo only in UI state. |

---

## UC-33 - Dashboard: Import Departments from File

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Create many departments from a file. |
| User Actions | Upload CSV/XLSX. Preview department names. Confirm import. |
| MVC / Repository Slice | `OwnerDashboardPage` -> import departments API -> `departmentImportService` -> `departmentRepository` -> `departments`. |
| Sequence Focus | UI uploads file, controller passes parsed rows or file ref, service validates duplicates, repository inserts departments. |
| Developer Notes | No emails are sent. Keep separate from Import Members. |

---

# Module 2 - Report

Report summarizes the allocation system after data exists.

---

## UC-48 - Report: View Workforce Analytics

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Show operational summary of shifts, tasks, attendance, hours, utilization, and risks. |
| User Actions | Select date range and department. View charts/cards. Export report if implemented. |
| MVC / Repository Slice | `OwnerReportPage` -> report API -> `reportService.getWorkforceAnalytics` -> `reportRepository` -> `shifts`, `shift_assignments`, `tasks`, `attendance_records`, `departments`, `users`. |
| Sequence Focus | Page requests report filters, service aggregates data, repository fetches raw rows, service computes metrics, page renders summary. |
| Developer Notes | Report should be a roll-up of existing data, not a separate source of truth. AI anomaly detection can later reuse report service outputs. |

---

# Module 3 - Team / My Company

Team and My Company define who can be allocated work. These are important setup features but not the core allocation diagrams unless selected.

---

## UC-05 - Team: View Team Members

| Field | Detail |
|---|---|
| Status | Built / needs UI refinement |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Browse company members by role and department. |
| User Actions | View members. Filter/group by role. Open detail if implemented. |
| MVC / Repository Slice | `OwnerTeamPage` -> `/api/team/members` -> team service -> team repository -> `company_members`, `users`, department membership tables. |
| Sequence Focus | Page requests members for company, service sorts by role, repository loads company members, page renders member list. |
| Developer Notes | Member department display should use membership tables where available. `users.department_id` is denormalized and should not be the only source for role membership in final version. |

---

## UC-06 - Team: Remove Team Member

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Remove a member from the company safely. |
| User Actions | Click remove. Confirm. |
| MVC / Repository Slice | `OwnerTeamPage` -> remove member API -> `ownerTeamService.removeMember` -> `ownerTeamRepository` -> `company_members`, `users`, inbox/messages/notifications cleanup. |
| Sequence Focus | Service validates permissions, removes membership, deletes account only if no remaining companies. |
| Developer Notes | Cannot remove self or company creator. Partner delete-company guard is separate. |

---

## UC-07 - Team: Change Member Department

| Field | Detail |
|---|---|
| Status | Built / needs membership-table refinement |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Reassign a member to a different department. |
| User Actions | Open change department modal. Select department. Save. |
| MVC / Repository Slice | `OwnerTeamPage` -> update department API -> user/team service -> user/team repository -> `users`, role department membership table. |
| Sequence Focus | Page submits member and department id, service validates scope, repository updates department membership. |
| Developer Notes | Manager, Employee, and Casual Worker should use their authoritative membership tables in final version. |

---

## UC-08 - Team: Change Member Reporting Manager

| Field | Detail |
|---|---|
| Status | Built / needs final schema rules |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Update who a member reports to. |
| User Actions | Open edit manager modal. Select manager. Save. |
| MVC / Repository Slice | `OwnerTeamPage` -> reporting manager API -> team service -> team repository -> `users` or membership/reporting table. |
| Sequence Focus | Service validates manager belongs to same company/department, repository updates reporting relationship. |
| Developer Notes | Current schema has `invitation_code.reporting_manager_id`, but final reporting relationship may need a dedicated member reporting table if required. |

---

## UC-37 - Team: Import Members from File

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Invite many members from a file. |
| User Actions | Upload CSV/XLSX. Preview rows. Confirm. System sends invitation emails. |
| MVC / Repository Slice | `OwnerTeamPage` -> import members API -> `memberImportService` -> invitation repository + email service -> `invitation_code`, email provider. |
| Sequence Focus | Service validates role/email/department rows, creates invitation code per row, sends email per valid member, returns success/failure summary. |
| Developer Notes | Emails are sent. This differs from Import Departments. |

---

# Module 4 - Communication

Communication supports operations but is not the Smart Allocation core.

---

## UC-09 - Communication: Post Announcement

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Broadcast information to a company or department. |
| User Actions | Create announcement. Choose audience. Post. |
| MVC / Repository Slice | `OwnerCommunicationPage` -> announcement API -> announcement service -> announcement repository -> `announcements`. |
| Sequence Focus | Controller validates title/content/audience, repository inserts announcement. |
| Developer Notes | Announcements and Messages belong in one Communication module with tabs. |

---

## UC-10 - Communication: Read Announcement

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Read announcements relevant to the current user. |
| User Actions | Open Communication. Select announcement. |
| MVC / Repository Slice | Communication page -> announcement API -> service -> repository -> `announcements`. |
| Sequence Focus | Page fetches announcements scoped by company/department, user opens item. |
| Developer Notes | Unread tracking may require separate table if final requirement needs per-user read state. |

---

## UC-11 - Communication: Edit Own Announcement

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Correct or update a posted announcement. |
| User Actions | Select own announcement. Edit. Save. |
| MVC / Repository Slice | Communication page -> announcement API PATCH -> service permission check -> repository update -> `announcements`. |
| Sequence Focus | Service confirms current user is original sender before update. |
| Developer Notes | Only original poster should see edit/delete. |

---

## UC-12 - Communication: Delete Own Announcement

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Remove own announcement. |
| User Actions | Select own announcement. Delete. Confirm. |
| MVC / Repository Slice | Communication page -> announcement API DELETE -> service permission check -> repository delete -> `announcements`. |
| Sequence Focus | User confirms deletion, service checks ownership, repository deletes row. |
| Developer Notes | Avoid deleting other users' announcements. |

---

## UC-13 - Communication: Send Direct Message

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Send private messages between internal team members. |
| User Actions | Select recipient. Type message. Send. |
| MVC / Repository Slice | Communication page -> messages API -> inbox/message service -> message repository -> `messages`. |
| Sequence Focus | Controller validates sender/recipient/content, repository inserts message, page refreshes conversation. |
| Developer Notes | Casual Workers are excluded from current direct-message rule. |

---

# Module 5 - Inbox

---

## UC-14 - Inbox: Accept / Decline Company Invitation

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Accept or decline invitation to another company/role. |
| User Actions | Open inbox invitations. Accept or decline. |
| MVC / Repository Slice | Inbox page -> invite API -> inbox service -> inbox repository/company repository -> `inbox`, `company_members`, `users`. |
| Sequence Focus | Service validates invite, updates membership, updates inbox status. |
| Developer Notes | Do not set invitation `used_by` before internal `users` row exists. |

---

# Module 6 - Recruitment

Recruitment builds the casual worker pool that later becomes schedulable for allocation.

---

## UC-39 - Recruitment: Post Job Opening

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Publish job openings for Guest Users/Casual Workers to apply. |
| User Actions | Create job posting. Enter title, department, employment type, location, pay, description, requirements. Publish. |
| MVC / Repository Slice | `OwnerRecruitmentPage` -> recruitment API -> `recruitmentService.createJobPosting` -> `recruitmentRepository` -> `job_postings`. |
| Sequence Focus | Service validates department/company, repository inserts job posting, public job board can read open postings. |
| Developer Notes | Existing schema has `job_postings`. Manager version should be department scoped. |

---

## UC-40 - Recruitment: Edit / Archive / Duplicate Job Opening

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Maintain job postings after creation. |
| User Actions | Edit posting. Archive posting. Duplicate posting. |
| MVC / Repository Slice | Recruitment page -> recruitment API PATCH/duplicate -> recruitment service -> recruitment repository -> `job_postings`. |
| Sequence Focus | Service validates ownership/scope, repository updates or copies posting. |
| Developer Notes | Archived jobs should not appear as open on public job board. |

---

## UC-41 - Recruitment: View Applicant List

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Review applicants for a job posting. |
| User Actions | Open posting. View applicants. Sort/filter by status/fit. |
| MVC / Repository Slice | Recruitment page -> applicants API -> recruitment service -> recruitment repository -> `job_applicants`, `job_postings`. |
| Sequence Focus | Page requests applicants for job, service validates posting scope, repository returns applicants. |
| Developer Notes | Candidate recommendation can later score this applicant list. |

---

## UC-42 - Recruitment: Accept / Reject Applicant

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Decide whether an applicant should join the casual worker pool. |
| User Actions | Accept applicant or reject applicant. Accepted applicant receives invitation. |
| MVC / Repository Slice | Recruitment page -> applicant decision API -> recruitment service -> recruitment repository + invitation/email service -> `job_applicants`, `job_invitations`, `users`/`invitation_code`. |
| Sequence Focus | Service updates applicant status, creates job invitation, sends invite or notification. |
| Developer Notes | On successful onboarding, applicant becomes a Casual Worker and can later be scheduled via `shift_assignments`. |

---

## UC-43 - Recruitment: Set Casual Worker Inactive / Blocked

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Prevent unsuitable or unavailable casual workers from being scheduled or applying. |
| User Actions | Open worker profile. Set inactive or blocked. |
| MVC / Repository Slice | Recruitment/Team page -> worker status API -> worker service -> worker repository -> `users` plus status table/column to be added if needed. |
| Sequence Focus | Service validates permission and status transition, repository updates worker availability status. |
| Developer Notes | Current `users` schema has no inactive/blocked status. This likely needs SQL migration. |

---

# Module 7 - Attendance

Attendance proves whether allocated work was actually performed.

---

## UC-44 - Attendance: Final Approve / Reject / Modify Record

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Owner gives final approval for attendance after lower-tier review. |
| User Actions | Owner opens reviewed queue. Approves, rejects, or modifies attendance record. |
| MVC / Repository Slice | `OwnerAttendancePage` -> attendance API -> `attendanceService.finalApproveAttendance` -> `attendanceRepository` -> `attendance_records`, `shift_assignments`, `shifts`, `users`. |
| Sequence Focus | Casual Worker clocks in/out, Employee confirms/submits, Manager reviews, Owner final approves/rejects. |
| Developer Notes | Existing `attendance_records` schema has employee and manager notes but may need owner final fields/history for modification. |

---

## UC-45 - Attendance: Track Status and Flag No-shows / Late / Overtime

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Track attendance exceptions against scheduled shifts. |
| User Actions | View attendance status board. See late, absent, overtime, pending approval. |
| MVC / Repository Slice | Attendance page -> attendance status API -> `attendanceService.getAttendanceExceptions` -> attendance repository -> `attendance_records`, `shift_assignments`, `shifts`. |
| Sequence Focus | Service compares clock-in/out times against scheduled shift times and returns exception flags. |
| Developer Notes | Manual rule-based logic first. AI auto-approve can later reuse clean/flagged classification. |

---

## UC-46 - Attendance: Manage Time-off and Break-waiver Requests

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Approve or reject availability/time-off requests that affect scheduling. |
| User Actions | Open request queue. Approve or reject. |
| MVC / Repository Slice | Attendance page -> request API -> request service -> request repository -> time-off/request table to be added. |
| Sequence Focus | User submits request, Owner/Manager reviews, service blocks scheduling window if approved. |
| Developer Notes | Current schema lacks time-off table. Requires SQL migration if implemented. |

---

## UC-47 - Attendance: Approve Shift Swap Request

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P2 Support Diagram |
| Goal | Allow workers to trade shifts with approval. |
| User Actions | Open swap request. Review both workers. Approve or reject. |
| MVC / Repository Slice | Attendance/Dashboard page -> shift swap API -> `shiftSwapService.approveSwapRequest` -> shift swap repository + shift repository -> swap table, `shift_assignments`. |
| Sequence Focus | Service validates both workers are eligible, updates `shift_assignments` if approved, records decision. |
| Developer Notes | Current schema lacks shift swap table. Requires SQL migration. |

---

# Module 8 - Settings

Settings is company administration, not the main Smart Allocation flow.

---

## UC-15 - Settings: Edit Company Profile

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner with restrictions |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Update company profile information. |
| User Actions | Edit company name, description, location, industry, size. |
| MVC / Repository Slice | Settings/Team page -> company profile API -> company service -> company repository -> `companies`. |
| Sequence Focus | Service checks permission, repository updates company profile. |
| Developer Notes | Company creator has full control. Partner restrictions apply to invited companies. |

---

## UC-16 - Settings: Create Additional Company

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Register another company under same Owner account. |
| User Actions | Add company. Fill company details. Create. |
| MVC / Repository Slice | Settings page -> company create API -> company service -> company repository -> `companies`, `company_members`. |
| Sequence Focus | Service creates company and owner membership. |
| Developer Notes | New company must become available in active company switcher. |

---

## UC-17 - Settings: Delete Company

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner only, company creator only |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Permanently delete company. |
| User Actions | Click delete. Confirm. |
| MVC / Repository Slice | Settings page -> delete company API -> company service -> company repository -> company and dependent tables. |
| Sequence Focus | Service validates creator ownership, repository deletes dependent records safely. |
| Developer Notes | Partner cannot delete a company they were invited into. |

---

## UC-18 - Settings: Manage Subscription Plan

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner with restrictions |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Upgrade or downgrade subscription. |
| User Actions | Choose Free/Paid plan. Save. |
| MVC / Repository Slice | Settings/Dashboard plan UI -> company plan API -> company service -> company repository -> `companies.plan`. |
| Sequence Focus | Controller validates plan, service checks permission, repository updates plan. |
| Developer Notes | Real payment integration is outside current scope unless required later. |

---

## UC-19 - Settings: Leave Company

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Leave a company the user belongs to. |
| User Actions | Click leave. Confirm. |
| MVC / Repository Slice | Settings/Team page -> leave company API -> user/company service -> user/team repository -> `company_members`, `users`, invitations/inbox cleanup. |
| Sequence Focus | Service removes membership and deletes account only if no remaining companies. |
| Developer Notes | Company creator should not leave/delete through the invited-user flow. |

---

## UC-20 - Logout

| Field | Detail |
|---|---|
| Status | Built |
| Actors | Owner, Partner, Manager, Employee, Casual Worker, Guest User |
| Smart Allocation Relevance | Support |
| Diagram Priority | P3 Context Only |
| Goal | Sign out of the application. |
| User Actions | Click Logout. |
| MVC / Repository Slice | Sidebar/page -> signout API -> auth service -> Supabase Auth. |
| Sequence Focus | UI calls signout, server clears session, user redirects to sign-in. |
| Developer Notes | Not recommended for detailed Smart Allocation diagrams. |

---

# Module 9 - AI Features

AI is limited to four features. Each must be manual-first behind a service function, then AI can replace the decision function later.

---

## UC-49 - AI: Anomaly Detection

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Surface unusual scheduling, task, or attendance patterns. |
| User Actions | View anomaly highlights on Dashboard/Report. Review flagged issue. |
| MVC / Repository Slice | Dashboard/Report page -> anomaly API -> `anomalyDetectionService.detectAnomalies` -> repositories -> `shifts`, `shift_assignments`, `tasks`, `attendance_records`. |
| Sequence Focus | Service gathers operational data, runs manual rules first, returns anomaly list. AI API can later replace scoring logic only. |
| Developer Notes | Manual examples: uncovered shift, clopening risk, overdue task, late/absent worker, overtime. |

---

## UC-50 - AI: Auto-approve Timesheets

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager, Employee, Casual Worker |
| Smart Allocation Relevance | Core |
| Diagram Priority | P1 Core Diagram |
| Goal | Auto-approve clean attendance records and flag suspicious ones. |
| User Actions | Owner enables/reviews auto-approval. System approves clean records or flags mismatches. |
| MVC / Repository Slice | Attendance page -> auto-approve API -> `attendanceService.autoApproveTimesheets` -> attendance repository -> `attendance_records`, `shifts`, `shift_assignments`. |
| Sequence Focus | Service compares attendance against shift assignment and manual rules, updates records or returns flags. |
| Developer Notes | Manual-first service function. AI must not leak into route/page/repository. |

---

## UC-51 - AI: Candidate Recommendation

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Rank job applicants by suitability for open casual-worker roles. |
| User Actions | Open applicant list. View recommended candidates. Owner/Manager makes final decision. |
| MVC / Repository Slice | Recruitment page -> recommendation API -> `candidateRecommendationService.recommendCandidates` -> recruitment repository -> `job_applicants`, `job_postings`. |
| Sequence Focus | Service loads applicants and job requirements, manual scoring ranks candidates, page displays ranking. |
| Developer Notes | AI later swaps into `recommendCandidates(applicants, jobPosting)` only. |

---

## UC-52 - AI: Job Description Generator

| Field | Detail |
|---|---|
| Status | Built, needs full testing |
| Actors | Owner, Partner, Manager |
| Smart Allocation Relevance | Related |
| Diagram Priority | P2 Support Diagram |
| Goal | Generate draft job descriptions for recruitment postings. |
| User Actions | Enter role/key points. Click Generate. Edit generated description. |
| MVC / Repository Slice | Recruitment page -> job description API -> `jobDescriptionService.generateDescription` -> no repository unless saved to `job_postings`. |
| Sequence Focus | Page sends role and key points, service returns template/manual generated text, page inserts into form. |
| Developer Notes | This is the weakest Smart Allocation link. Include only if the manual needs all AI features represented. |

---

# Summary For Team Planning

## Current Development Blocks

| Block | UC Range | Feature Area | Current State |
|---|---:|---|---|
| Block 1 | UC-21, UC-22, UC-23 | Shift CRUD, Timeline, Date Navigation | Built, actively testing/fixing |
| Block 2 | UC-24, UC-25, UC-26 | Task Creation, Assignment, Viewing, Sub-tasks | Built, needs full testing |
| Block 3 | UC-27, UC-28, UC-29 | Publish Schedule, Duplicate/Recurring Shift, Acceptance Deadline | Built, needs full testing |
| Block 4 | UC-30, UC-31, UC-32 | Clopening, Split Shift View, Undo | Built, needs full testing |
| Block 5 | UC-39 to UC-43 | Recruitment | Built, needs full testing |
| Block 6 | UC-44 to UC-47 | Attendance | Built, needs full testing |
| Block 7 | UC-33, UC-37, UC-48 | Imports and Report | Built, needs full testing |
| Block 8 | UC-49 to UC-52 | AI Features | Built, needs full testing |

## Suggested Diagram Set

For a Smart Task Allocation-focused manual, prioritize P1 and selected P2 use cases. Avoid spending diagram effort on login, logout, company profile, and basic messaging unless required by the rubric.

## Final Submission Rule

Before final submission, update every diagram so names match final code:

- Page/component name
- API route path
- Service method
- Repository method
- Type/interface
- Supabase table/column names
