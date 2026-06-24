# Tasking — Use Cases List

Complete, code-verified use case inventory across all roles, organized by feature module. Each use case is numbered continuously (UC1–UC100, no gaps) and tagged with its subscription tier.

**Tier legend**
- **Free** — included in the free plan
- **Paid** — gated behind a paid subscription
- **N/A** — platform-internal feature, not part of the customer-facing Owner/Partner subscription tiers (operated by a separate platform role)

---

## Module 1 — Shift UC1–14

- UC1 View Allocation Timeline — Free — Owner, Partner, Manager, Employee
- UC2 Filter Timeline by Date Range — Free — Owner, Partner, Manager, Employee
- UC3 Create Shift — Free — Owner, Partner, Manager
- UC4 Create Shift Template — Paid — Owner, Partner, Manager
- UC5 Edit Shift — Free — Owner, Partner, Manager
- UC6 Delete Shift — Free — Owner, Partner, Manager
- UC7 Publish / Unpublish Schedule — Free — Owner, Partner, Manager
- UC8 Duplicate Shift — Paid — Owner, Partner, Manager
- UC9 Set Recurring Shift — Paid — Owner, Partner, Manager
- UC10 Create Split Shift — Free — Owner, Partner, Manager
- UC11 View Clopening Conflict Warning — Paid — Owner, Partner, Manager
- UC12 Undo and Redo Last Shift Action — Free — Owner, Partner, Manager
- UC13 Bulk Shift Editor — Paid — Owner, Partner, Manager
- UC14 AI Auto-Schedule — Paid — Owner, Partner, Manager

## Module 2 — Task UC15–28

- UC15 Assign Task — Free — Owner, Partner, Manager, Employee
- UC16 View Task Kanban Board — Free — Owner, Partner, Manager, Employee
- UC17 Edit Task — Free — Owner, Partner, Manager, Employee
- UC18 Delete Task — Free — Owner, Partner, Manager, Employee
- UC19 Duplicate Task — Paid — Owner, Partner, Manager, Employee
- UC20 Set Recurring Task — Paid — Owner, Partner, Manager, Employee
- UC21 Archive Task — Free — Owner, Partner, Manager, Employee
- UC22 Create Sub Task — Free — Owner, Partner, Manager, Employee
- UC23 Task Calendar View — Paid — Owner, Partner, Manager, Employee
- UC24 AI Task Assignment — Paid — Owner, Partner, Manager
- UC25 View Workload Rebalancing Suggestion — Paid — Owner, Partner, Manager
- UC26 View Task Reassignment Suggestion — Paid — Owner, Partner, Manager
- UC27 View Stalled Task Alert — Paid — Owner, Partner, Manager
- UC28 Set Task Dependencies — Paid — Owner, Partner, Manager, Employee

## Module 3 — Team / Company UC29–43

- UC29 Create Department — Free — Owner, Partner
- UC30 Edit Department — Free — Owner, Partner
- UC31 Delete Department — Free — Owner, Partner
- UC32 Send Direct Invitation — Free — Owner, Partner, Manager
- UC33 Reassign Manager's Department — Free — Owner, Partner
- UC34 View Team Members — Free — Owner, Partner, Manager, Employee
- UC35 Search Members — Free — Owner, Partner, Manager, Employee
- UC36 Inactive / Active Casual Workers — Paid — Owner, Partner, Manager
- UC37 Remove Team Member — Free — Owner, Partner, Manager
- UC38 Change Member's Department — Free — Owner, Partner
- UC39 Invite Members by CSV File — Paid — Owner, Partner
- UC40 Import Departments from CSV File — Paid — Owner, Partner
- UC41 View Organization Chart — Paid — Owner, Partner, Manager, Employee
- UC42 View Activity Log — Paid — Owner, Partner, Manager
- UC43 Edit Company Profile — Free — Owner, Partner

## Module 4 — Recruitment UC44–61

- UC44 Post Job Opening — Free — Owner, Partner, Manager
- UC45 Create Job Template — Paid — Owner, Partner, Manager
- UC46 Edit Job Opening — Free — Owner, Partner, Manager
- UC47 Archive Job Opening — Free — Owner, Partner, Manager
- UC48 Duplicate Job Opening — Paid — Owner, Partner, Manager
- UC49 Save Job Posting as Draft — Free — Owner, Partner, Manager
- UC50 Submit Job Posting for Approval — Paid — Manager
- UC51 Approve / Reject Job Posting — Paid — Owner, Partner
- UC52 Set Job Acceptance Deadline — Free — Owner, Partner, Manager
- UC53 View Applicant List — Free — Owner, Partner, Manager
- UC54 Accept Applicant — Free — Owner, Partner, Manager
- UC55 Reject Applicant — Free — Owner, Partner, Manager
- UC56 Accept Job Invitation — Free — Casual Worker, Guest User
- UC57 Reject Job Invitation — Free — Casual Worker, Guest User
- UC58 Set Casual Worker Account Status — Paid — Owner, Partner, Manager
- UC59 AI Job Description Generator — Paid — Owner, Partner, Manager
- UC60 AI Candidate Recommendation — Paid — Owner, Partner, Manager
- UC61 Browse Public Job Board — Free — Guest User, Casual Worker

## Module 5 — Attendance UC62–72

- UC62 Clock In / Clock Out — Free — Employee, Casual Worker
- UC63 Review Attendance Record — Free — Owner, Partner, Manager, Employee
- UC64 View Attendance Status — Free — Owner, Partner, Manager, Employee, Casual Worker
- UC65 Submit Time-off Request — Free — Employee, Casual Worker
- UC66 Submit Break Waiver Request — Free — Employee, Casual Worker
- UC67 Submit Shift Swap Request — Free — Employee, Casual Worker
- UC68 Approve Shift Swap Request — Free — Owner, Partner, Manager, Employee
- UC69 AI Auto-approve Timesheets — Paid — Owner, Partner, Manager
- UC70 Configure Auto-Approval Settings — Paid — Owner, Partner, Manager
- UC71 Submit Fixed Day Off — Free — Employee, Casual Worker
- UC72 Submit Leave Request — Free — Employee, Casual Worker

## Module 6 — Communication UC73–76

- UC73 Post Announcement — Free — Owner, Partner, Manager, Employee
- UC74 Edit Own Announcement — Free — Owner, Partner, Manager, Employee
- UC75 Delete Own Announcement — Free — Owner, Partner, Manager, Employee
- UC76 Send Direct Message — Free — Owner, Partner, Manager, Employee, Casual Worker

## Module 7 — Report UC77–79

- UC77 View Workforce Analytics — Paid — Owner, Partner, Manager
- UC78 View AI Anomaly Detection Report — Paid — Owner, Partner, Manager
- UC79 Export Report as CSV — Paid — Owner, Partner, Manager

## Module 8 — Settings & Billing UC80–84

- UC80 Switch Active Company — Free — Owner, Partner, Manager, Employee
- UC81 Create Additional Company — Paid — Owner, Partner
- UC82 Delete Company — Free — Owner
- UC83 Leave Company — Free — Owner, Partner, Manager, Employee
- UC84 Manage Subscription Plan — Free — Owner, Partner

## Module 9 — Account & Authentication UC85–91

- UC85 Register Account — Free — Owner, Partner, Manager, Employee, Casual Worker, Guest User
- UC86 Sign In — Free — Owner, Partner, Manager, Employee, Casual Worker, Guest User, User Admin, Marketing Admin
- UC87 Forgot / Reset Password — Free — Owner, Partner, Manager, Employee, Casual Worker, Guest User, User Admin, Marketing Admin
- UC88 Email Verification / Resend Confirmation — Free — Owner, Partner, Manager, Employee, Casual Worker, Guest User
- UC89 Edit Own Profile — Free — Owner, Partner, Manager, Employee, Casual Worker
- UC90 Accept Company Invitation — Free — Owner, Partner, Manager, Employee
- UC91 Logout — Free — Owner, Partner, Manager, Employee, Casual Worker, Guest User, User Admin, Marketing Admin

## Module 10 — Marketing CMS UC92–95

Operated by a separate `Marketing Admin` role, outside the Owner/Partner/Manager/Employee/Casual Worker/Guest User hierarchy.

- UC92 View Marketing Page List — N/A — Marketing Admin
- UC93 Edit Marketing Page — N/A — Marketing Admin
- UC94 Edit Content Block — N/A — Marketing Admin
- UC95 View Public Marketing Page — N/A — Guest User, Owner, Partner, Manager, Employee, Casual Worker

## Module 11 — User & Company Admin UC96–100

Operated by a separate `User Admin` role, outside the Owner/Partner/Manager/Employee/Casual Worker/Guest User hierarchy.

- UC96 View and Search All Companies — N/A — User Admin
- UC97 View and Search All Users — N/A — User Admin
- UC98 View Company Detail — N/A — User Admin
- UC99 Suspend Company — N/A — User Admin
- UC100 Suspend User Account — N/A — User Admin

---

## Summary

- Total use cases: **100**
- Free: **59**
- Paid: **32**
- N/A (platform-internal): **9**
