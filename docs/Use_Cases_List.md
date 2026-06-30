# Tasking — Use Cases List

Complete, code-verified use case inventory across all roles, organized by feature module. Each use case is numbered continuously (UC1–UC80, no gaps) and tagged with its subscription tier.

**Tier legend**
- **Free** — included in the free plan
- **Paid** — gated behind a paid subscription
- **N/A** — platform-internal feature, not part of the customer-facing Owner/Partner subscription tiers (operated by a separate platform role)

**Role abbreviations:** O = Owner, P = Partner, M = Manager, E = Employee, CW = Casual Worker, GU = Guest User, UA = User Admin, MA = Marketing Admin

---

## Module 1 — Shift UC1–11

- UC1 Create Shift — Free — O, P, M
- UC2 Create Shift Template — Paid — O, P, M
- UC3 Edit Shift — Free — O, P, M
- UC4 Delete Shift — Free — O, P, M
- UC5 Publish / Unpublish Schedule — Free — O, P, M
- UC6 Duplicate Shift — Paid — O, P, M
- UC7 Set Recurring Shift — Paid — O, P, M
- UC8 Create Split Shift — Free — O, P, M
- UC9 View Clopening Conflict Warning — Paid — O, P, M
- UC10 Bulk Shift Editor — Paid — O, P, M
- UC11 Generate AI Schedule Suggestion — Paid — O, P, M

## Module 2 — Task UC12–23

- UC12 Assign Task — Free — O, P, M, E
- UC13 Edit Task — Free — O, P, M, E
- UC14 Create Task Template — Paid — O, P, M, E
- UC15 Delete Task — Free — O, P, M, E
- UC16 Duplicate Task — Paid — O, P, M, E
- UC17 Set Recurring Task — Paid — O, P, M, E
- UC18 Archive Task — Free — O, P, M, E
- UC19 Create Sub Task — Free — O, P, M, E
- UC20 Generate AI Task Assignment Suggestion — Paid — O, P, M
- UC21 View Workload Rebalancing Alert — Paid — O, P, M
- UC22 View Stalled Task Alert — Paid — O, P, M
- UC23 Set Task Dependencies — Paid — O, P, M

## Module 3 — Team / Company UC24–34

- UC24 Create Department — Free — O, P
- UC25 Edit Department — Free — O, P
- UC26 Delete Department — Free — O, P
- UC27 Send Direct Invitation — Free — O, P, M
- UC28 Search Members — Free — O, P, M, E
- UC29 Activate / Deactivate Casual Worker — Paid — O, P, M
- UC30 Remove Team Member — Free — O, P
- UC31 Change Member Department — Free — O, P
- UC32 Invite Members by CSV — Paid — O, P
- UC33 Import Departments by CSV — Paid — O, P
- UC34 Edit Company Profile — Free — O, P

## Module 4 — Recruitment UC35–48

- UC35 Post Job Opening — Free — O, P, M
- UC36 Create Job Template — Paid — O, P, M
- UC37 Edit Job Opening — Free — O, P, M
- UC38 Archive Job Opening — Free — O, P, M
- UC39 Duplicate Job Opening — Paid — O, P, M
- UC40 Save Job Posting as Draft — Free — O, P, M
- UC41 Submit Job Posting for Approval — Paid — M
- UC42 Approve / Reject Job Posting — Paid — O, P
- UC43 Set Application Deadline — Free — O, P, M
- UC44 View Applicant List — Free — O, P, M
- UC45 Accept / Reject Applicant — Free — O, P, M
- UC46 Accept / Reject Job Offer — Free — GU
- UC47 Generate AI Job Description Suggestion — Paid — O, P, M
- UC48 View AI Candidate Recommendation — Paid — O, P, M

## Module 5 — Attendance UC49–57

- UC49 Clock In / Clock Out — Free — M, E, CW
- UC50 Review Attendance Record — Free — O, P, M, E, CW
- UC51 View Attendance Status — Free — O, P, M
- UC52 Submit Shift Swap Request — Free — M, E
- UC53 Approve Shift Swap Request — Free — O, P, M
- UC54 Submit Fixed Day Off — Free — M, E
- UC55 Export Attendance Record — Paid — O, P, M
- UC56 Submit Leave Request — Free — M, E
- UC57 Approve Leave Request — Free — O, P, M

## Module 6 — Communication UC58–61

- UC58 Post Announcement — Free — O, P, M, E
- UC59 Edit Own Announcement — Free — O, P, M, E
- UC60 Delete Own Announcement — Free — O, P, M, E
- UC61 Send Direct Message — Free — O, P, M, E, CW

## Module 7 — Report UC62–64

- UC62 View Workforce Analytics — Paid — O, P, M
- UC63 View AI Anomaly Detection Report — Paid — O, P, M
- UC64 Export Report as CSV — Paid — O, P, M

## Module 8 — Account & Authentication UC65–71

- UC65 Register Account — Free — O, P, M, E, CW, GU
- UC66 Sign In — Free — All Users
- UC67 Forgot / Reset Password — Free — All Users
- UC68 Email Verification — Free — O, P, M, E, CW, GU
- UC69 Edit Own Profile — Free — O, P, M, E, CW
- UC70 Accept Company Invitation — Free — O, P, M, E, CW
- UC71 Logout — Free — All Users

## Module 9 — Marketing CMS UC72–75

Operated by a separate `Marketing Admin` role, outside the Owner/Partner/Manager/Employee/Casual Worker/Guest User hierarchy.

- UC72 View Marketing Page List — N/A — MA
- UC73 Edit Marketing Page — N/A — MA
- UC74 Edit Content Block — N/A — MA
- UC75 View Public Marketing Page — N/A — O, P, M, E, CW, GU

## Module 10 — User & Company Admin UC76–80

Operated by a separate `User Admin` role, outside the Owner/Partner/Manager/Employee/Casual Worker/Guest User hierarchy.

- UC76 View and Search All Companies — N/A — UA
- UC77 View and Search All Users — N/A — UA
- UC78 View Company Detail — N/A — UA
- UC79 Suspend Company — N/A — UA
- UC80 Suspend User Account — N/A — UA

---

## Summary

- Total use cases: **80**
- Free: **48**
- Paid: **23**
- N/A (platform-internal): **9**
