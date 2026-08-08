# Test Index

A lookup table of every UC's test files, grouped by module. This does not move any files, it is
purely an index of where things already live.

**Where things physically live:**
- Unit Test (Vitest) -- `src/services/<domain>/<serviceName>.uc<N>.test.ts`, colocated with the
  service file it tests. Run with `npm test`.
- Integration/E2E (Playwright) -- `tests/module<N>/<feature>-uc<N>.e2e.spec.ts`, grouped by module
  folder. Run with `npm run test:playwright -- tests/module<N>`.

E2E is not required per UC (see CLAUDE.md section 8) -- it only exists for P1 core journeys, so most
UCs have a Unit Test only. A UC row with no Integration/E2E entry is expected, not a gap. A UC row
with no Unit Test entry, however, means that UC's service-layer logic currently has no automated
coverage at all -- these are flagged below.

---

## Module 1: Shift (UC1-UC10)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC1 | Create Shift | `src/services/owner/shiftService.uc1.test.ts` | `tests/module1/shift-uc1.e2e.spec.ts` |
| UC2 | Create Shift Template | `src/services/owner/shiftTemplateService.uc2.test.ts` | |
| UC3 | Edit Shift | `src/services/owner/shiftService.uc3.test.ts` | |
| UC4 | Delete Shift | `src/services/owner/shiftService.uc4.test.ts` | |
| UC5 | Publish Schedule | `src/services/owner/shiftService.uc5.test.ts` | |
| UC6 | Duplicate Shift | `src/services/owner/shiftService.uc6.test.ts` | `tests/module1/shift-uc6.e2e.spec.ts` |
| UC7 | Set Recurring Shift | `src/services/owner/shiftService.uc7.test.ts` | |
| UC8 | Create Split Shift | `src/services/owner/shiftService.uc8.test.ts` | `tests/module1/shift-uc8.e2e.spec.ts` |
| UC9 | Bulk Edit Shifts | `src/services/owner/shiftService.uc9.test.ts` | `tests/module1/shift-uc9.e2e.spec.ts` |
| UC10 | Generate AI Schedule Suggestion | `src/services/owner/schedulingRuleService.uc10.test.ts` | |

## Module 2: Task (UC11-UC21)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC11 | Assign Task | `src/services/owner/taskService.uc11.test.ts` | `tests/module2/task-uc11.e2e.spec.ts` |
| UC12 | Edit Task | `src/services/owner/taskService.uc12.test.ts` | |
| UC13 | Create Task Template | `src/services/owner/taskTemplateService.uc13.test.ts` | |
| UC14 | Delete Task | `src/services/owner/taskService.uc14.test.ts` | |
| UC15 | Duplicate Task | `src/services/owner/taskService.uc15.test.ts` | |
| UC16 | Set Recurring Task | `src/services/owner/taskService.uc16.test.ts` | |
| UC17 | Archive Task | `src/services/owner/taskService.uc17.test.ts` | |
| UC18 | Create Sub Task | `src/services/owner/taskService.uc18.test.ts` | |
| UC19 | Generate AI Task Assignment Suggestion | `src/services/owner/aiTaskAssignService.uc19.test.ts` | |
| UC20 | Rebalance Task Workload | `src/services/owner/taskService.uc20.test.ts` | |
| UC21 | Set Task Dependencies | `src/services/owner/taskService.uc21.test.ts` | |

## Module 3: Team / Company (UC22-UC33)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC22 | Create Department | `src/services/company/companyService.uc22.test.ts` | |
| UC23 | Edit Department | `src/services/company/companyService.uc23.test.ts` | |
| UC24 | Delete Department | `src/services/company/companyService.uc24.test.ts` | |
| UC25 | Send Direct Invitation | `src/services/invitation/invitationService.uc25.test.ts` | |
| UC26 | Search Members | **none** | `tests/module3/team-uc26.e2e.spec.ts` |
| UC27 | Activate Casual Worker | `src/services/team/casualWorkerStatusService.uc27.test.ts` | |
| UC28 | Deactivate Casual Worker | `src/services/team/casualWorkerStatusService.uc28.test.ts` | |
| UC29 | Remove Team Member | `src/services/owner/ownerTeamService.uc29.test.ts` | |
| UC30 | Change Member Department | `src/services/owner/ownerTeamService.uc30.test.ts` | |
| UC31 | Invite Members by CSV | `src/services/owner/importService.uc31.test.ts` | |
| UC32 | Import Departments by CSV | `src/services/owner/importService.uc32.test.ts` | |
| UC33 | Edit Company Profile | `src/services/company/companyService.uc33.test.ts` | |

## Module 4: Recruitment (UC34-UC49)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC34 | Publish Job Opening | `src/services/owner/recruitmentService.uc34.test.ts` | |
| UC35 | Create Job Template | `src/services/owner/jobTemplateService.uc35.test.ts` | |
| UC36 | Edit Job Template | `src/services/owner/jobTemplateService.uc36.test.ts` | |
| UC37 | Archive Job Opening | `src/services/owner/recruitmentService.uc37.test.ts` | |
| UC38 | Duplicate Draft Job | `src/services/owner/recruitmentService.uc38.test.ts` | |
| UC39 | Save Job as Draft | `src/services/owner/recruitmentService.uc39.test.ts` | |
| UC40 | Submit Job Posting for Approval | `src/services/owner/recruitmentService.uc40.test.ts` | |
| UC41 | Approve Job Posting | `src/services/owner/recruitmentService.uc41.test.ts` | |
| UC42 | Reject Job Posting | `src/services/owner/recruitmentService.uc42.test.ts` | |
| UC43 | Set Application Deadline | `src/services/owner/recruitmentService.uc43.test.ts` | |
| UC44 | Accept Applicant | `src/services/owner/recruitmentService.uc44.test.ts` | |
| UC45 | Reject Applicant | `src/services/owner/recruitmentService.uc45.test.ts` | |
| UC46 | Accept Job Offer | `src/services/guest/workerApplicationService.uc46.test.ts` | |
| UC47 | Reject Job Offer | `src/services/guest/workerApplicationService.uc47.test.ts` | |
| UC48 | Generate AI Job Description Suggestion | `src/services/owner/jobDescriptionService.uc48.test.ts` | |
| UC49 | Recommend Candidates via AI | `src/services/owner/candidateRecommendationService.uc49.test.ts` | |

## Module 5: Attendance (UC50-UC61)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC50 | Clock In | `src/services/casual/casualAttendanceService.uc50.test.ts`, `src/services/employee/employeeAttendanceService.uc50.test.ts` | |
| UC51 | Clock Out | `src/services/casual/casualAttendanceService.uc51.test.ts`, `src/services/employee/employeeAttendanceService.uc51.test.ts` | |
| UC52 | Break In | `src/services/casual/casualAttendanceService.uc52.test.ts`, `src/services/employee/employeeAttendanceService.uc52.test.ts` | |
| UC53 | Break Out | `src/services/casual/casualAttendanceService.uc53.test.ts`, `src/services/employee/employeeAttendanceService.uc53.test.ts` | |
| UC54 | Submit Shift Swap Request | `src/services/owner/attendanceService.uc54.test.ts` | |
| UC55 | Approve Shift Swap Request | `src/services/owner/attendanceService.uc55.test.ts` | |
| UC56 | Reject Shift Swap Request | `src/services/owner/attendanceService.uc56.test.ts` | |
| UC57 | Submit Day Off Request | `src/services/owner/attendanceService.uc57.test.ts` | |
| UC58 | Approve Day Off Request | `src/services/owner/attendanceService.uc58.test.ts` | |
| UC59 | Modify Day Off Request | `src/services/owner/attendanceService.uc59.test.ts` | |
| UC60 | Modify Clock Time | `src/services/owner/attendanceService.uc60.test.ts` | |
| UC61 | Generate AI Day Off Suggestion | `src/services/ai/requestAISuggestService.uc61.test.ts` | |

## Module 6: Communication (UC62-UC65)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC62 | Post Announcement | `src/services/owner/ownerAnnouncementService.uc62.test.ts` | `tests/module6/communication-uc62.e2e.spec.ts` |
| UC63 | Edit Announcement | `src/services/owner/ownerAnnouncementService.uc63.test.ts` | |
| UC64 | Delete Announcement | `src/services/owner/ownerAnnouncementService.uc64.test.ts` | |
| UC65 | Send Direct Message | `src/services/owner/ownerInboxService.uc65.test.ts`, `src/services/casual/casualInboxService.uc65.test.ts` | |

## Module 7: Report (UC66-UC68)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC66 | Generate Workforce Analytics Report | `src/services/owner/reportService.uc66.test.ts` | |
| UC67 | Generate AI Report Insight | `src/services/owner/anomalyDetectionService.uc67.test.ts` | |
| UC68 | Export Report | **none** | `tests/module7/report-uc68.e2e.spec.ts` |

## Module 8: Account & Authentication (UC69-UC75)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC69 | Register Account | `src/services/auth/authService.uc69.test.ts`, `src/services/invitation/invitationService.uc69.test.ts` | |
| UC70 | Sign In | `src/services/auth/authService.uc70.test.ts` | |
| UC71 | Reset Password | `src/services/auth/authService.uc71.test.ts` | `tests/module8/auth-uc71.e2e.spec.ts` |
| UC72 | Verify Email | `src/services/auth/authService.uc72.test.ts` | `tests/module8/auth-uc72.e2e.spec.ts` |
| UC73 | Edit Profile | `src/services/auth/userService.uc73.test.ts`, `src/services/guest/workerProfileService.uc73.test.ts` | |
| UC74 | Accept Company Invitation | `src/services/invitation/invitationService.uc74.test.ts` | |
| UC75 | Log Out | `src/services/auth/authService.uc75.test.ts` | |
| -- | *(no UC -- URL-layer RBAC security regression, see CLAUDE.md section 10.5)* | | `tests/module8/auth-url-guard.e2e.spec.ts` |

## Module 9: Marketing CMS (UC76)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC76 | Edit Marketing Page | `src/services/marketingadmin/marketingAdminService.uc76.test.ts` | |

## Module 10: User & Company Admin (UC77-UC78)

| UC | Name | Unit Test | Integration/E2E |
|---|---|---|---|
| UC77 | Suspend Company | `src/services/userAdmin/userAdminService.uc77.test.ts` | |
| UC78 | Suspend User Account | `src/services/userAdmin/userAdminService.uc78.test.ts` | |

---

## Coverage gaps surfaced by this index

- **UC26 (Search Members)** and **UC68 (Export Report)** have an Integration/E2E spec but no Unit
  Test file. Every other UC follows the section 8 workflow (Unit Test required, E2E optional); these
  two are the exception and should be backfilled if picked up again.
