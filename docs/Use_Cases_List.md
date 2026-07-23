# Tasking — Use Cases List

Complete use case inventory across all roles, organized by feature module. Each use case is numbered continuously (UC1–UC80, no gaps).

**System roles**

Internal company hierarchy (strict superset chain):

```
Owner  ->  Partner  ->  Manager  ->  Employee  ->  Casual Worker  ->  Guest User
```

Platform-level roles (outside the company hierarchy): **User Admin** and **Marketing Admin**.

**Role abbreviations:** O = Owner, P = Partner, M = Manager, E = Employee, CW = Casual Worker, GU = Guest User, UA = User Admin, MA = Marketing Admin

> Features that exist in the codebase but are intentionally NOT part of this list (kept in code, not counted as use cases): Settings & Billing / Stripe subscription, Leave Request flow, Export Attendance Record, Casual Worker availability, Leave Company, create-additional / switch / delete company, Guest job application & withdrawal, task review/rework flow, activity log, CW job history, marketing-site reviews & feedback.

---

## Module 1 — Shift UC1–11

- UC1 Create Shift — O, P
- UC2 Create Shift Template — O, P
- UC3 Edit Shift — O, P
- UC4 Delete Shift — O, P
- UC5 Publish / Unpublish Schedule — O, P
- UC6 Duplicate Shift — O, P
- UC7 Set Recurring Shift — O, P
- UC8 Create Split Shift — O, P
- UC9 View Clopening Conflict Warning — O, P
- UC10 Bulk Shift Editor — O, P
- UC11 Generate AI Schedule Suggestion — O, P

## Module 2 — Task UC12–23

- UC12 Assign Task — O, P, M, E
- UC13 Edit Task — O, P, M, E
- UC14 Create Task Template — O, P, M
- UC15 Delete Task — O, P, M, E
- UC16 Duplicate Task — O, P, M
- UC17 Set Recurring Task — O, P, M
- UC18 Archive Task — O, P, M
- UC19 Create Sub Task — O, P, M, E
- UC20 Generate AI Task Assignment Suggestion — O, P, M
- UC21 View Workload Rebalancing Alert — O, P, M
- UC22 View Task Delay Alert — O, P, M
- UC23 Set Task Dependencies — O, P, M

## Module 3 — Team / Company UC24–34

- UC24 Create Department — O
- UC25 Edit Department — O
- UC26 Delete Department — O
- UC27 Send Direct Invitation — O, P
- UC28 Search Members — O, P, M
- UC29 Activate / Deactivate Casual Worker — O, P
- UC30 Remove Team Member — O
- UC31 Change Member Department — O
- UC32 Invite Members by CSV — O, P
- UC33 Import Departments by CSV — O
- UC34 Edit Company Profile — O

## Module 4 — Recruitment UC35–48

- UC35 Publish Job Opening — O, P
- UC36 Create Job Template — O, P, M
- UC37 Edit Job Template — O, P, M
- UC38 Archive Job Opening — O, P
- UC39 Duplicate Draft Job — O, P, M
- UC40 Save Job as Draft — O, P, M
- UC41 Submit Job Posting for Approval — M
- UC42 Approve / Reject Job Posting — O, P
- UC43 Set Application Deadline — O, P, M
- UC44 View Applicant List — O, P, M
- UC45 Accept / Reject Applicant — O, P, M
- UC46 Accept / Reject Job Offer — GU
- UC47 Generate AI Job Description Suggestion — O, P, M
- UC48 View AI Candidate Recommendation — O, P, M

## Module 5 — Attendance UC49–57

- UC49 Clock In / Clock Out — M, E, CW
- UC50 Review Attendance Record — O, P, M, E, CW
- UC51 View Attendance Status — O, P, M
- UC52 Submit Shift Swap Request — M, E
- UC53 Approve / Reject Shift Swap Request — M (for Employee requests), O, P (for a Manager's own request)
- UC54 Submit Fixed Day Off — M, E
- UC55 Approve / Reject Fixed Day Off — O, P (always — regardless of whether the requester is Manager or Employee)
- UC56 Modify Clock In / Out Time — O, P, M (Manager scoped to their own department's Employee/Casual Worker records only, never a peer Manager's)
- UC57 AI Review Requests — O, P, M

## Module 6 — Communication UC58–61

- UC58 Post Announcement — O, P, M
- UC59 Edit Own Announcement — O, P, M
- UC60 Delete Own Announcement — O, P, M
- UC61 Send Direct Message — O, P, M, E, CW

## Module 7 — Report UC62–64

- UC62 View Workforce Analytics — O, P
- UC63 View AI Anomaly Detection Report — O, P
- UC64 Export Report — O, P

## Module 8 — Account & Authentication UC65–71

- UC65 Register Account — O, P, M, E, CW, GU
- UC66 Sign In — All Users
- UC67 Forgot / Reset Password — All Users
- UC68 Email Verification — O, P, M, E, CW, GU
- UC69 Edit Own Profile — O, P, M, E, CW, GU
- UC70 Accept Company Invitation — P, M, E
- UC71 Logout — All Users

## Module 9 — Marketing CMS UC72–75

Operated by a separate `Marketing Admin` role, outside the Owner/Partner/Manager/Employee/Casual Worker/Guest User hierarchy.

- UC72 View Marketing Page List — MA
- UC73 Edit Marketing Page — MA
- UC74 Edit Content Block — MA
- UC75 View Public Marketing Page — O, P, M, E, CW, GU

## Module 10 — User & Company Admin UC76–80

Operated by a separate `User Admin` role, outside the Owner/Partner/Manager/Employee/Casual Worker/Guest User hierarchy.

- UC76 View and Search All Companies — UA
- UC77 View and Search All Users — UA
- UC78 View Company Detail — UA
- UC79 Suspend Company — UA
- UC80 Suspend User Account — UA

---

## Summary

- Total use cases: **80**
