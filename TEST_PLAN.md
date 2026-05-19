# TEST_PLAN.md — FYP Tasking Application

**Generated:** 2026-05-16  
**Branch:** shuai-cheng  
**Scope:** Manual end-to-end and API integration tests based on actual source code

---

## Table of Contents

1. [How to Reset State Between Runs](#1-how-to-reset-state-between-runs)
2. [Recommended Test Order](#2-recommended-test-order)
3. [Authentication — API Tests](#3-authentication--api-tests)
4. [Authentication — UI Tests](#4-authentication--ui-tests)
5. [Owner Registration Flow (get-started)](#5-owner-registration-flow-get-started)
6. [Invitation Flow (get-started)](#6-invitation-flow-get-started)
7. [Company Management — API Tests](#7-company-management--api-tests)
8. [Company Management — UI Tests (Settings Page)](#8-company-management--ui-tests-settings-page)
9. [Department Management — API Tests](#9-department-management--api-tests)
10. [Department Management — UI Tests (Dashboard)](#10-department-management--ui-tests-dashboard)
11. [Invitation Code — API Tests](#11-invitation-code--api-tests)
12. [Invitation Code — UI Tests (Dashboard)](#12-invitation-code--ui-tests-dashboard)
13. [Team Management — API Tests](#13-team-management--api-tests)
14. [Team Management — UI Tests](#14-team-management--ui-tests)
15. [User Profile — API Tests](#15-user-profile--api-tests)
16. [Session & Navigation Tests](#16-session--navigation-tests)
17. [Health Check](#17-health-check)

---

## 1. How to Reset State Between Runs

### Database Reset (Supabase)

Run the following SQL in the Supabase SQL Editor in this exact order (foreign key constraints require it):

```sql
-- 1. Clear invitation codes
DELETE FROM invitation_codes;

-- 2. Clear departments
DELETE FROM departments;

-- 3. Clear users (public.users table, not auth.users)
DELETE FROM users;

-- 4. Clear companies
DELETE FROM companies;

-- 5. Clear auth users via Supabase Admin API or Dashboard:
--    Go to Authentication → Users → Delete all test users manually,
--    OR use the service role key to call admin.deleteUser() for each.
```

> **Important:** You cannot delete `auth.users` rows with plain SQL. Use the Supabase Dashboard → Authentication → Users to delete test auth users, or use the service-role admin API.

### Browser State Reset

Before each test session (or between runs where a different user logs in):

1. Open DevTools → Application → Local Storage → Clear all entries under your localhost/domain
2. Open DevTools → Application → Session Storage → Clear all
3. Open DevTools → Application → Cookies → Delete all cookies for the domain
4. Alternatively, open an **Incognito / Private window** for each test user

**Keys written by the app (clear these specifically if not doing a full wipe):**

| Key | Storage | Written By |
|---|---|---|
| `tasking_user_id` | localStorage | Sign-in page |
| `tasking_company_id_${userId}` | localStorage | Sign-in, dashboard, team page |
| `tasking_user_role` | localStorage | Sign-in page |
| `tasking_session_active` | sessionStorage | Sign-in page |

---

## 2. Recommended Test Order

Run tests in this sequence to avoid dependency failures:

```
Section 17 (Health)
→ Section 3 (Auth API)
→ Section 4 (Auth UI — sign in / sign out)
→ Section 5 (Owner registration)
→ Section 7 (Company API)
→ Section 8 (Settings UI)
→ Section 9 (Department API)
→ Section 10 (Dashboard UI — departments)
→ Section 11 (Invitation Code API)
→ Section 12 (Dashboard UI — invite codes)
→ Section 13 (Team API)
→ Section 14 (Team UI)
→ Section 6 (Invitation redemption flow — requires a live code from Sections 11–12)
→ Section 15 (User Profile API)
→ Section 16 (Session & Navigation)
```

---

## 3. Authentication — API Tests

Base URL: `http://localhost:3000` (or your deployed URL)

### TC-AUTH-001 — Sign in with valid credentials

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-001 |
| **Endpoint** | `POST /api/auth/signin` |
| **Method** | POST |

**Steps:**
1. Register an owner first via the get-started flow (or seed the DB manually).
2. `POST /api/auth/signin` with body:
   ```json
   { "email_address": "owner@test.com", "password": "password123" }
   ```

**Expected result (pass):**
```json
{
  "success": true,
  "user": {
    "id": "<uuid>",
    "role": "Owner",
    "full_name": "Test Owner",
    "company_id": "<uuid>"
  }
}
```
HTTP status: 200

---

### TC-AUTH-002 — Sign in with wrong password

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-002 |
| **Endpoint** | `POST /api/auth/signin` |

**Steps:**
1. `POST /api/auth/signin` with body:
   ```json
   { "email_address": "owner@test.com", "password": "wrongpassword" }
   ```

**Expected error:**
```json
{ "success": false, "message": "Invalid email or password" }
```
HTTP status: 401

---

### TC-AUTH-003 — Sign in with non-existent email

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-003 |
| **Endpoint** | `POST /api/auth/signin` |

**Steps:**
1. `POST /api/auth/signin` with:
   ```json
   { "email_address": "nobody@nowhere.com", "password": "password123" }
   ```

**Expected error:**
```json
{ "success": false, "message": "Invalid email or password" }
```
HTTP status: 401

---

### TC-AUTH-004 — Sign in with missing fields

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-004 |
| **Endpoint** | `POST /api/auth/signin` |

**Steps:**
1. `POST /api/auth/signin` with empty body `{}`

**Expected error:** HTTP status 400, `success: false`

---

### TC-AUTH-005 — Sign out

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-005 |
| **Endpoint** | `POST /api/auth/signout` |

**Steps:**
1. Sign in first via TC-AUTH-001.
2. `POST /api/auth/signout` (no body required).

**Expected result:** HTTP status 200, `{ "success": true }`  
Supabase session cookie is cleared.

---

### TC-AUTH-006 — Check email (exists)

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-006 |
| **Endpoint** | `POST /api/auth/check-email` |

**Steps:**
1. Use email of an existing user with a company_id.
2. `POST /api/auth/check-email` with `{ "email": "owner@test.com" }`

**Expected result:**
```json
{ "exists": true }
```

---

### TC-AUTH-007 — Check email (does not exist)

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-007 |
| **Endpoint** | `POST /api/auth/check-email` |

**Steps:**
1. `POST /api/auth/check-email` with `{ "email": "ghost@nowhere.com" }`

**Expected result:**
```json
{ "exists": false }
```

---

### TC-AUTH-008 — Check phone (exists)

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-008 |
| **Endpoint** | `POST /api/auth/check-phone` |

**Steps:**
1. Register a user with phone `91234567`.
2. `POST /api/auth/check-phone` with `{ "phone": "91234567" }`

**Expected result:** `{ "exists": true }`

---

### TC-AUTH-009 — Check phone (does not exist)

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-009 |
| **Endpoint** | `POST /api/auth/check-phone` |

**Steps:**
1. `POST /api/auth/check-phone` with `{ "phone": "00000000" }`

**Expected result:** `{ "exists": false }`

---

### TC-AUTH-010 — Forgot password with valid email

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-010 |
| **Endpoint** | `POST /api/auth/forgot-password` |

**Steps:**
1. `POST /api/auth/forgot-password` with `{ "email": "owner@test.com" }`

**Expected result:**
```json
{ "success": true }
```
HTTP status: 200  
Check that a password-reset email was dispatched (visible in Supabase Auth logs or email inbox).

---

### TC-AUTH-011 — Forgot password with missing email

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-011 |
| **Endpoint** | `POST /api/auth/forgot-password` |

**Steps:**
1. `POST /api/auth/forgot-password` with `{}`

**Expected error:** HTTP status 400, `{ "success": false, "message": "email is required" }`

---

### TC-AUTH-012 — Complete owner setup (full happy path)

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-012 |
| **Endpoint** | `POST /api/auth/complete-owner-setup` |

**Steps:**
1. `POST /api/auth/complete-owner-setup` with:
   ```json
   {
     "full_name": "Alice Owner",
     "email": "alice@test.com",
     "password": "securepassword",
     "phone": "81111111",
     "company_name": "Alice Corp",
     "company_description": "Test company",
     "departments": ["Operations", "HR"],
     "plan": "Free"
   }
   ```

**Expected result:**
```json
{ "success": true, "user_id": "<uuid>", "company_id": "<uuid>" }
```
HTTP status: 201  
Verify in DB: auth user created, users row created, company row created, 2 department rows created.

---

### TC-AUTH-013 — Complete owner setup with duplicate email

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-013 |
| **Endpoint** | `POST /api/auth/complete-owner-setup` |

**Pre-condition:** TC-AUTH-012 already ran (alice@test.com exists).

**Steps:**
1. `POST /api/auth/complete-owner-setup` with the same email `alice@test.com`.

**Expected error:**
```json
{ "success": false, "message": "An account with this email already exists." }
```
HTTP status: 400

---

### TC-AUTH-014 — Complete owner setup with duplicate phone

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-014 |
| **Endpoint** | `POST /api/auth/complete-owner-setup` |

**Pre-condition:** TC-AUTH-012 already ran (phone 81111111 exists).

**Steps:**
1. `POST /api/auth/complete-owner-setup` with a different email but phone `81111111`.

**Expected error:**
```json
{ "success": false, "message": "This phone number is already registered to another account." }
```
HTTP status: 400

---

### TC-AUTH-015 — Complete owner setup with missing required fields

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-015 |
| **Endpoint** | `POST /api/auth/complete-owner-setup` |

**Steps:**
1. `POST /api/auth/complete-owner-setup` with `{ "email": "missing@test.com" }` (no name, password, company_name).

**Expected error:** HTTP status 400, missing field message.

---

### TC-AUTH-016 — Create profile directly

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-016 |
| **Endpoint** | `POST /api/auth/create-profile` |

**Steps:**
1. Create a Supabase auth user manually (or via register endpoint).
2. `POST /api/auth/create-profile` with:
   ```json
   {
     "user_id": "<supabase-auth-uuid>",
     "full_name": "Bob Profile",
     "email_address": "bob@test.com",
     "phone_number": null,
     "role": "Employee",
     "company_id": "<valid-company-uuid>",
     "department_id": null
   }
   ```

**Expected result:** HTTP status 201, `{ "success": true }`

---

### TC-AUTH-017 — Reset password (valid session)

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-017 |
| **Endpoint** | `POST /api/auth/reset-password` |

**Steps:**
1. Trigger forgot password for a user (TC-AUTH-010).
2. Open the reset link from the email — this sets a `PASSWORD_RECOVERY` session.
3. `POST /api/auth/reset-password` with `{ "password": "newpassword123" }`

**Expected result:** `{ "success": true }`, HTTP 200.  
Verify: sign in with new password succeeds; sign in with old password fails.

---

### TC-AUTH-018 — Reset password with short password

| Field | Value |
|---|---|
| **Test ID** | TC-AUTH-018 |
| **Endpoint** | `POST /api/auth/reset-password` |

**Steps:**
1. During a valid recovery session: `POST /api/auth/reset-password` with `{ "password": "abc" }` (3 chars, under minimum 6).

**Expected error:** HTTP 400, message indicating minimum length.

---

## 4. Authentication — UI Tests

### TC-UI-AUTH-001 — Sign in and redirect by role (Owner)

| Field | Value |
|---|---|
| **Test ID** | TC-UI-AUTH-001 |
| **URL** | `/signin` |

**Steps:**
1. Open `/signin`.
2. Enter email: `owner@test.com`, password: `password123`.
3. Click "Sign in".

**Expected result:**
- Redirected to `/owner/dashboard`.
- localStorage contains `tasking_user_id`.
- localStorage contains `tasking_company_id_${userId}`.
- localStorage contains `tasking_user_role` = "Owner".

---

### TC-UI-AUTH-002 — Sign in shows error for bad credentials

| Field | Value |
|---|---|
| **Test ID** | TC-UI-AUTH-002 |
| **URL** | `/signin` |

**Steps:**
1. Open `/signin`.
2. Enter email: `owner@test.com`, password: `wrongpassword`.
3. Click "Sign in".

**Expected result:**
- Stays on `/signin`.
- Red error banner is visible with message "Invalid email or password".
- No localStorage keys set.

---

### TC-UI-AUTH-003 — Sign out clears state

| Field | Value |
|---|---|
| **Test ID** | TC-UI-AUTH-003 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** User is signed in.

**Steps:**
1. Click the sign-out action in the sidebar.
2. Observe the `/signout` page.
3. Check localStorage and sessionStorage.

**Expected result:**
- Redirected to `/signout` page showing "You've been signed out".
- localStorage keys `tasking_user_id`, `tasking_company_id_*`, `tasking_user_role` are removed.
- sessionStorage key `tasking_session_active` is removed.
- Link on page points back to `/signin`.

---

### TC-UI-AUTH-004 — Unauthenticated access to dashboard redirects

| Field | Value |
|---|---|
| **Test ID** | TC-UI-AUTH-004 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** Not signed in (cleared all browser state).

**Steps:**
1. Navigate directly to `/owner/dashboard`.

**Expected result:** Redirected to `/signin`.

---

### TC-UI-AUTH-005 — Forgot password UI

| Field | Value |
|---|---|
| **Test ID** | TC-UI-AUTH-005 |
| **URL** | `/forgot-password` |

**Steps:**
1. Open `/forgot-password`.
2. Enter `owner@test.com`.
3. Submit.

**Expected result:** Success message "Check your email for a reset link" appears.

---

### TC-UI-AUTH-006 — Reset password — password mismatch

| Field | Value |
|---|---|
| **Test ID** | TC-UI-AUTH-006 |
| **URL** | `/reset-password` |

**Pre-condition:** Valid password recovery session active.

**Steps:**
1. Enter New Password: `newpass123`.
2. Enter Confirm Password: `different456`.
3. Submit.

**Expected result:** Error shown, passwords do not match. No API call made.

---

## 5. Owner Registration Flow (get-started)

### TC-FLOW-REG-001 — Full owner registration (4 steps)

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-REG-001 |
| **URL** | `/get-started` |

**Steps:**
1. Open `/get-started`, choose "Create a company" (owner path).
2. **Step 1 — Account:**
   - Full Name: `Test Owner`
   - Email: `testowner@example.com`
   - Password: `password123`
   - Phone: (leave blank / optional)
   - Click Next.
3. **Step 2 — Company Info:**
   - Company Name: `TestCorp`
   - Description: `A test company`
   - Click Next.
4. **Step 3 — Departments:**
   - Add department: `Engineering`
   - Add department: `Marketing`
   - Click Next.
5. **Step 4 — Choose Plan:**
   - Select Free.
   - Click Complete Setup.

**Expected result:**
- Redirected to `/owner/dashboard` immediately.
- Dashboard title shows `TestCorp — Overview`.
- Departments list shows `Engineering` and `Marketing`.
- User role badge shows "Free user".

---

### TC-FLOW-REG-002 — Duplicate email blocked during registration

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-REG-002 |
| **URL** | `/get-started` |

**Pre-condition:** `testowner@example.com` already registered (TC-FLOW-REG-001).

**Steps:**
1. Attempt Step 1 with same email `testowner@example.com`.

**Expected result:** Error shown in UI: email already exists (checked via `POST /api/auth/check-email`). Cannot advance to Step 2.

---

### TC-FLOW-REG-003 — Invalid phone format blocked

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-REG-003 |
| **URL** | `/get-started` |

**Steps:**
1. Step 1 with Phone: `123` (fewer than 8 digits after stripping non-numeric).
2. Click Next.

**Expected result:** Client-side validation error. Cannot advance.

---

### TC-FLOW-REG-004 — Registration without departments (skip)

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-REG-004 |
| **URL** | `/get-started` |

**Steps:**
1. Complete Steps 1–2 with valid data.
2. Step 3: Click "Skip for now" without adding any departments.
3. Step 4: Select Free plan and submit.

**Expected result:**
- Registration completes.
- Dashboard shows 0 departments ("No departments yet. Add your first one.").

---

### TC-FLOW-REG-005 — Pro plan selection

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-REG-005 |
| **URL** | `/get-started` |

**Steps:**
1. Complete Steps 1–3 with valid data.
2. Step 4: Select Pro plan.
3. Click Complete Setup.

**Expected result:**
- Success message shown.
- After ~2 seconds, redirected to `/owner/dashboard`.
- Plan badge shows "Pro user" in dashboard header.

---

### TC-FLOW-REG-006 — Registration with max 5 departments

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-REG-006 |
| **URL** | `/get-started` |

**Steps:**
1. Step 3: Add departments: `Dept1`, `Dept2`, `Dept3`, `Dept4`, `Dept5`.
2. Try to add a 6th department.

**Expected result:** UI prevents adding more than 5 departments (button disabled or hidden after 5).

---

## 6. Invitation Flow (get-started)

### TC-FLOW-INV-001 — Redeem valid invitation code (Manager)

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-001 |
| **URL** | `/get-started` |

**Pre-condition:**
- Owner registered (TC-FLOW-REG-001).
- Owner generated a Manager invitation code for `Engineering` department (from dashboard invite modal). Note the 5-digit code.

**Steps:**
1. Open `/get-started` (in a fresh incognito window).
2. Choose "I have an invitation code" path.
3. Step 1 — Account:
   - Full Name: `Test Manager`
   - Email: `testmanager@example.com`
   - Password: `password123`
   - Phone: (blank)
   - Click Next.
4. Step 2 — Enter Code:
   - Enter the 5-digit Manager code.
   - Click Redeem.

**Expected result:**
- Registration completes.
- User created with role `Manager`, company = TestCorp, department = Engineering.
- Redirected to `/owner/dashboard` (or dashboard for their role).
- Manager appears in team list at `/owner/team`.

---

### TC-FLOW-INV-002 — Redeem code with pre-filled URL parameter

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-002 |
| **URL** | `/get-started?code=XXXXX` |

**Pre-condition:** Valid code generated by owner.

**Steps:**
1. Navigate to `/get-started?code=<valid-code>`.
2. Complete Step 1 with new user credentials.
3. Observe Step 2.

**Expected result:** Code input field is pre-filled with the code from the URL parameter. No manual entry needed.

---

### TC-FLOW-INV-003 — Redeem expired invitation code

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-003 |
| **Endpoint** | `POST /api/invitation/redeem` |

**Pre-condition:** Manually set an invitation code's `expired_at` to a past date in the DB.

**Steps:**
1. Attempt to redeem the expired code:
   ```json
   {
     "code": "<expired-code>",
     "full_name": "Expired User",
     "email": "expired@test.com",
     "password": "password123",
     "phone_number": null
   }
   ```

**Expected error:**
```json
{ "success": false, "message": "This invitation has expired" }
```
HTTP status: 400

---

### TC-FLOW-INV-004 — Redeem invalid/non-existent code

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-004 |
| **Endpoint** | `POST /api/invitation/redeem` |

**Steps:**
1. `POST /api/invitation/redeem` with `"code": "ZZZZZ"` (non-existent).

**Expected error:**
```json
{ "success": false, "message": "Invalid or expired invitation code" }
```
HTTP status: 400

---

### TC-FLOW-INV-005 — Redeem code with already-registered email

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-005 |
| **Endpoint** | `POST /api/invitation/redeem` |

**Pre-condition:** `testowner@example.com` already has an account.

**Steps:**
1. `POST /api/invitation/redeem` with email `testowner@example.com` and a valid code.

**Expected error:**
```json
{ "success": false, "message": "An account with this email already exists. Please sign in instead." }
```
HTTP status: 400

---

### TC-FLOW-INV-006 — Redeem code creates correct role assignment

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-006 |
| **Endpoint** | `POST /api/invitation/redeem` |

**Steps:**
1. Generate an Employee code for `Engineering` department.
2. Redeem the code with a new user email.

**Expected result:**
- New user has `role = 'Employee'`.
- New user's `company_id` = TestCorp id.
- New user's `department_id` = Engineering id.
- Verify in Supabase DB: `users` table row has correct values.

---

### TC-FLOW-INV-007 — Same code used twice

| Field | Value |
|---|---|
| **Test ID** | TC-FLOW-INV-007 |
| **Endpoint** | `POST /api/invitation/redeem` |

**Pre-condition:** Valid code already redeemed once (TC-FLOW-INV-001).

**Steps:**
1. Attempt to redeem the same code again with a new user.

**Expected error:** Code should be marked as used/expired. Response: invalid or expired code error.

---

## 7. Company Management — API Tests

### TC-CO-001 — Get company by owner

| Field | Value |
|---|---|
| **Test ID** | TC-CO-001 |
| **Endpoint** | `GET /api/company/by-owner?owner_id=<auth-uuid>` |

**Steps:**
1. Use the auth UUID of an owner who registered via TC-FLOW-REG-001.
2. `GET /api/company/by-owner?owner_id=<uuid>`

**Expected result:**
```json
{ "success": true, "company": { "id": "<uuid>", "name": "TestCorp", ... } }
```

---

### TC-CO-002 — Get company by owner — no company

| Field | Value |
|---|---|
| **Test ID** | TC-CO-002 |
| **Endpoint** | `GET /api/company/by-owner?owner_id=<uuid>` |

**Steps:**
1. Use an owner_id that exists in `users` but has no company (edge case — orphaned user).

**Expected error:** HTTP 404, `{ "success": false, "message": "Company not found" }`

---

### TC-CO-003 — Get current company context

| Field | Value |
|---|---|
| **Test ID** | TC-CO-003 |
| **Endpoint** | `GET /api/company/current?user_id=<auth-uuid>` |

**Steps:**
1. `GET /api/company/current?user_id=<owner-auth-uuid>`

**Expected result:**
```json
{
  "success": true,
  "role": "Owner",
  "company": { "id": "<uuid>", "name": "TestCorp", "plan": "Free" },
  "companies": [...]
}
```

---

### TC-CO-004 — Get current company with explicit company_id

| Field | Value |
|---|---|
| **Test ID** | TC-CO-004 |
| **Endpoint** | `GET /api/company/current` |

**Steps:**
1. `GET /api/company/current?user_id=<uuid>&company_id=<valid-company-uuid>`

**Expected result:** Returns the specified company if the user has access to it.

---

### TC-CO-005 — Get my-companies for owner with one company

| Field | Value |
|---|---|
| **Test ID** | TC-CO-005 |
| **Endpoint** | `GET /api/company/my-companies?owner_id=<uuid>` |

**Expected result:**
```json
{ "success": true, "companies": [{ "id": "...", "name": "TestCorp", ... }] }
```

---

### TC-CO-006 — Create additional company

| Field | Value |
|---|---|
| **Test ID** | TC-CO-006 |
| **Endpoint** | `POST /api/company/create-additional` |

**Steps:**
1. `POST /api/company/create-additional` with:
   ```json
   {
     "owner_id": "<internal-user-uuid>",
     "name": "SecondCorp",
     "description": "Second company",
     "departments": ["Sales"]
   }
   ```

**Expected result:**
```json
{ "success": true, "company": { "id": "<uuid>", "name": "SecondCorp", ... } }
```
HTTP status: 201

---

### TC-CO-007 — Create additional company with blank name

| Field | Value |
|---|---|
| **Test ID** | TC-CO-007 |
| **Endpoint** | `POST /api/company/create-additional` |

**Steps:**
1. `POST /api/company/create-additional` with `{ "owner_id": "<uuid>", "name": "   " }` (whitespace only).

**Expected error:** HTTP 400, name is required.

---

### TC-CO-008 — Update company profile

| Field | Value |
|---|---|
| **Test ID** | TC-CO-008 |
| **Endpoint** | `PATCH /api/company/update-profile` |

**Steps:**
1. `PATCH /api/company/update-profile` with:
   ```json
   {
     "company_id": "<valid-uuid>",
     "name": "TestCorp Renamed",
     "description": "Updated description"
   }
   ```

**Expected result:**
```json
{ "success": true, "company": { "name": "TestCorp Renamed", ... } }
```

---

### TC-CO-009 — Update company with empty name

| Field | Value |
|---|---|
| **Test ID** | TC-CO-009 |
| **Endpoint** | `PATCH /api/company/update-profile` |

**Steps:**
1. `PATCH /api/company/update-profile` with `{ "company_id": "<uuid>", "name": "" }`

**Expected error:** HTTP 400, name required.

---

### TC-CO-010 — Delete secondary company

| Field | Value |
|---|---|
| **Test ID** | TC-CO-010 |
| **Endpoint** | `DELETE /api/company/delete` |

**Pre-condition:** Owner has 2 companies (TC-CO-006 ran).

**Steps:**
1. `DELETE /api/company/delete` with `{ "company_id": "<second-company-uuid>" }`

**Expected result:** HTTP 200, `{ "success": true }`. SecondCorp no longer exists in DB.

---

### TC-CO-011 — Delete primary company (blocked)

| Field | Value |
|---|---|
| **Test ID** | TC-CO-011 |
| **Endpoint** | `DELETE /api/company/delete` |

**Steps:**
1. Attempt to delete the company that was created during owner registration (the primary company).

**Expected error:**
```json
{
  "success": false,
  "message": "This is your primary company created during registration and cannot be deleted."
}
```
HTTP status: 200 (or 400 — check what the API actually returns; the logic returns a 200 with success: false based on code review).

---

### TC-CO-012 — Update plan

| Field | Value |
|---|---|
| **Test ID** | TC-CO-012 |
| **Endpoint** | `POST /api/company/update-plan` |

**Steps:**
1. `POST /api/company/update-plan` with:
   ```json
   { "company_id": "<uuid>", "plan": "Paid" }
   ```

**Expected result:** HTTP 200, `{ "success": true }`. Company plan in DB is now "Paid".

---

### TC-CO-013 — Update plan with invalid value

| Field | Value |
|---|---|
| **Test ID** | TC-CO-013 |
| **Endpoint** | `POST /api/company/update-plan` |

**Steps:**
1. `POST /api/company/update-plan` with `{ "company_id": "<uuid>", "plan": "Enterprise" }`

**Expected error:** HTTP 400, `"plan must be one of: Free, Paid"`.

---

## 8. Company Management — UI Tests (Settings Page)

### TC-UI-SET-001 — Edit company name

| Field | Value |
|---|---|
| **Test ID** | TC-UI-SET-001 |
| **URL** | `/owner/settings` |

**Steps:**
1. Sign in as owner, navigate to `/owner/settings`.
2. Click the Edit (pencil) icon on the company card.
3. Change name to `TestCorp Updated`.
4. Click Save.

**Expected result:** Company card updates to show `TestCorp Updated`. Modal closes.

---

### TC-UI-SET-002 — Add new company from Settings

| Field | Value |
|---|---|
| **Test ID** | TC-UI-SET-002 |
| **URL** | `/owner/settings` |

**Steps:**
1. Click "Add New Company".
2. Enter name: `BrandNewCo`, description: `desc`, add 1 department `Ops`.
3. Click Create.

**Expected result:**
- New company `BrandNewCo` appears in the companies list on settings page.
- Navigating to dashboard shows both companies in the company switcher.

---

### TC-UI-SET-003 — Delete secondary company from Settings

| Field | Value |
|---|---|
| **Test ID** | TC-UI-SET-003 |
| **URL** | `/owner/settings` |

**Pre-condition:** Owner has ≥2 companies.

**Steps:**
1. Click delete (trash) on the secondary company.
2. Confirm deletion in dialog.

**Expected result:** Company removed from list. Cannot delete primary company (delete button not shown or shows error).

---

### TC-UI-SET-004 — Cannot delete last/primary company

| Field | Value |
|---|---|
| **Test ID** | TC-UI-SET-004 |
| **URL** | `/owner/settings` |

**Pre-condition:** Owner has exactly 1 company.

**Expected result:** Delete button is absent or disabled for the only company card.

---

## 9. Department Management — API Tests

### TC-DEPT-001 — Get departments for company

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-001 |
| **Endpoint** | `GET /api/company/departments?company_id=<uuid>` |

**Expected result:**
```json
{ "success": true, "departments": [{ "id": "...", "name": "Engineering", ... }, ...] }
```

---

### TC-DEPT-002 — Get departments — missing company_id

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-002 |
| **Endpoint** | `GET /api/company/departments` |

**Steps:**
1. `GET /api/company/departments` with no query params.

**Expected error:** HTTP 400, `{ "success": false, "message": "company_id is required" }`

---

### TC-DEPT-003 — Create department

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-003 |
| **Endpoint** | `POST /api/company/create-department` |

**Steps:**
1. `POST /api/company/create-department` with:
   ```json
   { "company_id": "<valid-uuid>", "name": "Finance" }
   ```

**Expected result:**
```json
{ "success": true, "department": { "id": "<uuid>", "name": "Finance" } }
```

---

### TC-DEPT-004 — Create department with empty name

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-004 |
| **Endpoint** | `POST /api/company/create-department` |

**Steps:**
1. `POST /api/company/create-department` with `{ "company_id": "<uuid>", "name": "" }`

**Expected error:** HTTP 400, name required.

---

### TC-DEPT-005 — Update department name

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-005 |
| **Endpoint** | `PATCH /api/company/update-department` |

**Steps:**
1. `PATCH /api/company/update-department` with:
   ```json
   { "department_id": "<valid-dept-uuid>", "name": "Finance Renamed" }
   ```

**Expected result:**
```json
{ "success": true, "department": { "name": "Finance Renamed", ... } }
```

---

### TC-DEPT-006 — Update department with empty name

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-006 |
| **Endpoint** | `PATCH /api/company/update-department` |

**Steps:**
1. `PATCH /api/company/update-department` with `{ "department_id": "<uuid>", "name": "   " }`

**Expected error:** HTTP 400, name required.

---

### TC-DEPT-007 — Delete department

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-007 |
| **Endpoint** | `DELETE /api/company/delete-department` |

**Steps:**
1. `DELETE /api/company/delete-department` with `{ "department_id": "<valid-dept-uuid>" }`

**Expected result:** HTTP 200, `{ "success": true }`. Department no longer exists in DB.

---

### TC-DEPT-008 — Delete department without department_id

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-008 |
| **Endpoint** | `DELETE /api/company/delete-department` |

**Steps:**
1. `DELETE /api/company/delete-department` with `{}`

**Expected error:** HTTP 400, department_id required.

---

### TC-DEPT-009 — Get managers by department

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-009 |
| **Endpoint** | `GET /api/company/managers?company_id=<uuid>&department_id=<uuid>` |

**Pre-condition:** At least one Manager user exists in the department.

**Expected result:**
```json
{ "success": true, "managers": [{ "id": "<uuid>", "full_name": "Test Manager" }] }
```

---

### TC-DEPT-010 — Get managers — empty department

| Field | Value |
|---|---|
| **Test ID** | TC-DEPT-010 |
| **Endpoint** | `GET /api/company/managers` |

**Steps:**
1. Use a valid company and department that has no managers.

**Expected result:** `{ "success": true, "managers": [] }`

---

## 10. Department Management — UI Tests (Dashboard)

### TC-UI-DASH-001 — Add department via modal

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-001 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Click "Add Department" button.
2. Enter `New Dept` in the name field.
3. Click "Add Department" in modal.

**Expected result:** Modal closes. Department card `New Dept` appears in the grid.

---

### TC-UI-DASH-002 — Add department with empty name (blocked)

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-002 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Open Add Department modal.
2. Leave name blank.
3. Click "Add Department".

**Expected result:** Nothing happens (the `handleAddDept` function returns early if `deptFormName.trim()` is empty). No API call is made.

---

### TC-UI-DASH-003 — Edit department

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-003 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Click Edit (pencil) on an existing department card.
2. Change name to `Renamed Dept`.
3. Click "Save Changes".

**Expected result:** Card now shows `Renamed Dept`. Modal closes.

---

### TC-UI-DASH-004 — Delete department

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-004 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Click Delete (trash) on a department card.
2. Confirm in the delete modal by clicking "Delete".

**Expected result:** Department card disappears from grid.

---

### TC-UI-DASH-005 — Cancel delete department

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-005 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Click Delete on a department.
2. Click "Cancel" in modal.

**Expected result:** Modal closes, department still visible. No change.

---

### TC-UI-DASH-006 — Search filters departments

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-006 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** Multiple departments exist.

**Steps:**
1. Type `Eng` in the search box.

**Expected result:** Only departments whose names contain "eng" (case-insensitive) are shown.

---

### TC-UI-DASH-007 — Department sort: letters before numbers

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-007 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** Departments include `2ndFloor`, `Admin`, `Zebra`.

**Expected result:** Order is `Admin`, `Zebra`, `2ndFloor` (alphabetic entries before numeric-prefix entries).

---

### TC-UI-DASH-008 — ESC key closes modal

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-008 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Open Add Department modal.
2. Press Escape.

**Expected result:** Modal closes without saving.

---

### TC-UI-DASH-009 — Non-owner cannot see Add/Edit/Delete buttons

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-009 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** Sign in as a Manager (invited via TC-FLOW-INV-001).

**Steps:**
1. Navigate to `/owner/dashboard`.

**Expected result:**
- "Add Department" button is not visible.
- No Edit or Delete buttons on department cards.
- Department list is still visible (read-only view).

---

### TC-UI-DASH-010 — Company switcher (multiple companies)

| Field | Value |
|---|---|
| **Test ID** | TC-UI-DASH-010 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** Owner has 2+ companies.

**Steps:**
1. Click the company name header (dropdown arrow visible).
2. Select a different company.

**Expected result:**
- Title updates to the selected company name.
- Department grid reloads with the new company's departments.
- `localStorage.tasking_company_id_${userId}` updates to the new company id.

---

## 11. Invitation Code — API Tests

### TC-INV-001 — Generate Owner (Partner) invitation code

| Field | Value |
|---|---|
| **Test ID** | TC-INV-001 |
| **Endpoint** | `POST /api/invitation/generate` |

**Steps:**
1. `POST /api/invitation/generate` with:
   ```json
   {
     "company_id": "<valid-uuid>",
     "department_id": null,
     "role": "Owner",
     "generated_by": "<user-internal-uuid>"
   }
   ```

**Expected result:**
```json
{ "success": true, "code": "<8-char-alphanumeric>", "expired_at": "<ISO-date>" }
```
- `code` is exactly 8 characters, alphanumeric.
- `expired_at` is approximately 7 days from now.

---

### TC-INV-002 — Generate Manager invitation code

| Field | Value |
|---|---|
| **Test ID** | TC-INV-002 |
| **Endpoint** | `POST /api/invitation/generate` |

**Steps:**
1. `POST /api/invitation/generate` with:
   ```json
   {
     "company_id": "<valid-uuid>",
     "department_id": "<valid-dept-uuid>",
     "role": "Manager",
     "generated_by": "<user-uuid>"
   }
   ```

**Expected result:**
- `code` is exactly 5 digits (numeric only).

---

### TC-INV-003 — Generate Employee invitation code

| Field | Value |
|---|---|
| **Test ID** | TC-INV-003 |
| **Endpoint** | `POST /api/invitation/generate` |

**Steps:**
1. `POST /api/invitation/generate` with `role: "Employee"` and a valid department_id.

**Expected result:** `code` is exactly 5 digits.

---

### TC-INV-004 — Generate code with missing required field

| Field | Value |
|---|---|
| **Test ID** | TC-INV-004 |
| **Endpoint** | `POST /api/invitation/generate` |

**Steps:**
1. `POST /api/invitation/generate` with `{ "company_id": "<uuid>", "role": "Manager" }` (missing `generated_by`).

**Expected error:** HTTP 400, missing field.

---

### TC-INV-005 — Send invite email (happy path)

| Field | Value |
|---|---|
| **Test ID** | TC-INV-005 |
| **Endpoint** | `POST /api/invitation/send-invite` |

**Steps:**
1. `POST /api/invitation/send-invite` with:
   ```json
   {
     "email": "newmanager@example.com",
     "role": "Manager",
     "company_id": "<valid-uuid>",
     "department_id": "<valid-dept-uuid>",
     "invited_by": "<owner-user-uuid>",
     "reporting_manager_id": null
   }
   ```

**Expected result:** HTTP 200, `{ "success": true }`.  
Verify: invitation email sent to `newmanager@example.com` (check Resend logs or inbox).  
Verify: invitation_codes row created in DB with correct role, company, department.

---

### TC-INV-006 — Send invite to self (blocked)

| Field | Value |
|---|---|
| **Test ID** | TC-INV-006 |
| **Endpoint** | `POST /api/invitation/send-invite` |

**Steps:**
1. `POST /api/invitation/send-invite` where `email` is the email of the user identified by `invited_by`.

**Expected result:**
```json
{ "success": false, "message": "You cannot send an invitation to yourself." }
```
HTTP status: 200 (the API returns 200 with success: false for this case).

---

### TC-INV-007 — Send invite with missing required fields

| Field | Value |
|---|---|
| **Test ID** | TC-INV-007 |
| **Endpoint** | `POST /api/invitation/send-invite` |

**Steps:**
1. `POST /api/invitation/send-invite` with `{ "email": "x@x.com" }` (missing role, company_id, invited_by).

**Expected error:** HTTP 400.

---

## 12. Invitation Code — UI Tests (Dashboard)

### TC-UI-INV-001 — Generate Partner invite code from Dashboard

| Field | Value |
|---|---|
| **Test ID** | TC-UI-INV-001 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Sign in as owner, go to Dashboard.
2. Find the "Invite Partner" option (via sidebar or dedicated button — check UI).
3. Click "Generate Invite Code".

**Expected result:**
- 8-character alphanumeric code is displayed in the code box.
- "Copy Link" button becomes active (orange).

---

### TC-UI-INV-002 — Generate Manager invite code requires department selection

| Field | Value |
|---|---|
| **Test ID** | TC-UI-INV-002 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Open "Invite Manager" modal.
2. Observe the "Generate Invite Code" button state before selecting a department.

**Expected result:** Button is disabled (opacity 0.45, cursor not-allowed) until a department is selected.

---

### TC-UI-INV-003 — Copy Link writes to clipboard

| Field | Value |
|---|---|
| **Test ID** | TC-UI-INV-003 |
| **URL** | `/owner/dashboard` |

**Steps:**
1. Generate a code (any role).
2. Click "Copy Link".

**Expected result:**
- Button text briefly changes to "Copied!" (green background).
- Clipboard contains a message with the code and a link to `/get-started`.

---

### TC-UI-INV-004 — Invite Manager modal shows "No departments" message

| Field | Value |
|---|---|
| **Test ID** | TC-UI-INV-004 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** Company has no departments.

**Steps:**
1. Open "Invite Manager" modal.

**Expected result:** "No departments found. Please add a department first." message displayed. Code generation button not shown.

---

## 13. Team Management — API Tests

### TC-TEAM-001 — Get team members

| Field | Value |
|---|---|
| **Test ID** | TC-TEAM-001 |
| **Endpoint** | `GET /api/team/members?company_id=<uuid>` |

**Pre-condition:** Company has at least an Owner and one Manager.

**Expected result:**
```json
{
  "success": true,
  "members": [
    { "id": "...", "full_name": "Test Owner", "role": "Owner", ... },
    { "id": "...", "full_name": "Test Manager", "role": "Manager", ... }
  ]
}
```

---

### TC-TEAM-002 — Get team members — owner always included

| Field | Value |
|---|---|
| **Test ID** | TC-TEAM-002 |
| **Endpoint** | `GET /api/team/members?company_id=<uuid>` |

**Steps:**
1. Ensure the owner's `company_id` in the users table is different from the company being queried (e.g., they've switched companies).

**Expected result:** Owner still appears first in the members list (the `findMembersByCompanyId` function adds the owner from `companies.owner_id` even if the owner's `users.company_id` doesn't match).

---

### TC-TEAM-003 — Get team members — missing company_id

| Field | Value |
|---|---|
| **Test ID** | TC-TEAM-003 |
| **Endpoint** | `GET /api/team/members` |

**Steps:**
1. `GET /api/team/members` with no query params.

**Expected error:** HTTP 400.

---

## 14. Team Management — UI Tests

### TC-UI-TEAM-001 — Team page shows members grouped by role

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-001 |
| **URL** | `/owner/team` |

**Pre-condition:** Company has an Owner, 1 Manager, 1 Employee.

**Steps:**
1. Navigate to `/owner/team`.

**Expected result:**
- "OWNER / PARTNER" section shows owner.
- "MANAGER" section shows manager.
- "EMPLOYEE" section shows employee.
- Each card shows avatar initial, full name, email, role badge.

---

### TC-UI-TEAM-002 — Invite member via Team page (Manager)

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-002 |
| **URL** | `/owner/team` |

**Steps:**
1. Click "Invite Member".
2. Enter email: `newmember@example.com`.
3. Select Role: `Manager`.
4. Select company (auto-selected if only one).
5. Select department: `Engineering`.
6. Click "Send Invite".

**Expected result:** Green success message: "Invitation sent to newmember@example.com".

---

### TC-UI-TEAM-003 — Invite member — missing email shows error

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-003 |
| **URL** | `/owner/team` |

**Steps:**
1. Open Invite Member modal.
2. Leave email blank, select a role.
3. Click "Send Invite".

**Expected result:** Red error: "Email and role are required."

---

### TC-UI-TEAM-004 — Invite member — self-invite blocked in UI

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-004 |
| **URL** | `/owner/team` |

**Steps:**
1. Open Invite Member modal.
2. Enter the logged-in owner's own email.
3. Click "Send Invite".

**Expected result:** Red error: "You cannot send an invitation to yourself."

---

### TC-UI-TEAM-005 — Invite Employee — manager required warning

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-005 |
| **URL** | `/owner/team` |

**Pre-condition:** Selected department has no managers.

**Steps:**
1. Open Invite Member modal.
2. Select role `Employee`, select company, select department that has no managers.

**Expected result:**
- Reporting Manager dropdown shows "No managers in this department yet".
- "Send Invite" button is disabled.
- Tooltip (title): "Add a manager to this department first".

---

### TC-UI-TEAM-006 — Partner warning shown

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-006 |
| **URL** | `/owner/team` |

**Steps:**
1. Open Invite Member modal.
2. Select role `Partner` (mapped to Owner internally).

**Expected result:** Orange warning banner visible: "This person will have full Partner access to your company."

---

### TC-UI-TEAM-007 — ESC key closes invite modal

| Field | Value |
|---|---|
| **Test ID** | TC-UI-TEAM-007 |
| **URL** | `/owner/team` |

**Steps:**
1. Open Invite Member modal.
2. Press Escape.

**Expected result:** Modal closes, form is reset.

---

## 15. User Profile — API Tests

### TC-USR-001 — Get user by auth UUID

| Field | Value |
|---|---|
| **Test ID** | TC-USR-001 |
| **Endpoint** | `GET /api/user/me?user_id=<auth-uuid>` |

**Expected result:**
```json
{
  "success": true,
  "user": {
    "full_name": "Test Owner",
    "role": "Owner",
    "email_address": "owner@test.com",
    "company_id": "<uuid>"
  }
}
```

---

### TC-USR-002 — Get user by internal UUID

| Field | Value |
|---|---|
| **Test ID** | TC-USR-002 |
| **Endpoint** | `GET /api/user/me?user_id=<internal-users-uuid>` |

**Steps:**
1. Use the `id` from the `users` table (not `supabase_auth_id`).

**Expected result:** Same as TC-USR-001 (service resolves either type).

---

### TC-USR-003 — Get user — not found

| Field | Value |
|---|---|
| **Test ID** | TC-USR-003 |
| **Endpoint** | `GET /api/user/me?user_id=00000000-0000-0000-0000-000000000000` |

**Expected error:** HTTP 404, `{ "success": false, "message": "..." }`

---

### TC-USR-004 — Get user — missing user_id

| Field | Value |
|---|---|
| **Test ID** | TC-USR-004 |
| **Endpoint** | `GET /api/user/me` |

**Expected error:** HTTP 400, `{ "success": false, "message": "user_id is required" }`

---

## 16. Session & Navigation Tests

### TC-SESSION-001 — Dashboard persists company selection across navigation

| Field | Value |
|---|---|
| **Test ID** | TC-SESSION-001 |

**Steps:**
1. Sign in as owner.
2. On dashboard, switch to Company B via company switcher.
3. Navigate to Team page.
4. Navigate back to Dashboard.

**Expected result:** Dashboard still shows Company B (reads from `localStorage.tasking_company_id_${userId}`).

---

### TC-SESSION-002 — localStorage company key is user-scoped

| Field | Value |
|---|---|
| **Test ID** | TC-SESSION-002 |

**Steps:**
1. Sign in as User A. Set active company to Company A.
2. In same browser, open a second incognito window, sign in as User B.

**Expected result:** User B's localStorage key `tasking_company_id_${userBId}` is separate from User A's key. No cross-user pollution.

---

### TC-SESSION-003 — Team page company resolution fallback chain

| Field | Value |
|---|---|
| **Test ID** | TC-SESSION-003 |

**Steps:**
1. Sign in as owner.
2. Clear `tasking_company_id_${userId}` from localStorage manually.
3. Navigate to `/owner/team`.

**Expected result:** Team page uses Fallback 1 (`/api/user/me` → company_id) or Fallback 2 (`/api/company/by-owner`) to resolve the company and still loads team members.

---

### TC-SESSION-004 — Inbox and Report are placeholder pages

| Field | Value |
|---|---|
| **Test ID** | TC-SESSION-004 |
| **URLs** | `/owner/inbox`, `/owner/report` |

**Steps:**
1. Navigate to `/owner/inbox`.
2. Navigate to `/owner/report`.

**Expected result:** Each page shows a placeholder message ("Inbox coming soon" / "Report coming soon"). No errors.

---

### TC-SESSION-005 — No company linked shows warning banner

| Field | Value |
|---|---|
| **Test ID** | TC-SESSION-005 |
| **URL** | `/owner/dashboard` |

**Pre-condition:** User has a valid Supabase session but no `company_id` in their users row (e.g., a Guest User or orphaned record).

**Expected result:** Dashboard shows the amber warning banner: "No company is linked to your profile yet. If you just accepted an invitation, try signing out and signing in again, or contact your administrator."

---

## 17. Health Check

### TC-HEALTH-001 — Health endpoint returns OK

| Field | Value |
|---|---|
| **Test ID** | TC-HEALTH-001 |
| **Endpoint** | `GET /api/health` |

**Expected result:** HTTP 200. Confirms the server is running.

---

## Appendix A — API Route Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/signin` | Sign in |
| POST | `/api/auth/signout` | Sign out |
| POST | `/api/auth/register` | Register (basic) |
| POST | `/api/auth/complete-owner-setup` | Full owner + company setup |
| POST | `/api/auth/create-profile` | Create user profile row |
| POST | `/api/auth/check-email` | Check if email is registered |
| POST | `/api/auth/check-phone` | Check if phone is registered |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Set new password |
| GET | `/api/user/me` | Get current user details |
| GET | `/api/company/current` | Get active company context |
| GET | `/api/company/by-owner` | Get owner's first company |
| GET | `/api/company/my-companies` | Get all companies for owner |
| POST | `/api/company/setup` | Create company (basic) |
| POST | `/api/company/create-additional` | Create additional company |
| PATCH | `/api/company/update-profile` | Update company name/description |
| DELETE | `/api/company/delete` | Delete a company |
| POST | `/api/company/update-plan` | Update plan Free/Paid |
| GET | `/api/company/departments` | List departments |
| POST | `/api/company/create-department` | Create department |
| PATCH | `/api/company/update-department` | Rename department |
| DELETE | `/api/company/delete-department` | Delete department |
| GET | `/api/company/managers` | Get managers for department |
| POST | `/api/invitation/generate` | Generate invitation code |
| POST | `/api/invitation/send-invite` | Send invitation email |
| POST | `/api/invitation/redeem` | Redeem invitation code |
| GET | `/api/team/members` | Get all team members |

---

## Appendix B — Test Data Reference

| Label | Value |
|---|---|
| Owner email | `testowner@example.com` |
| Owner password | `password123` |
| Owner full name | `Test Owner` |
| Owner phone | (optional, blank) |
| Company name | `TestCorp` |
| Departments | `Engineering`, `Marketing` |
| Manager email | `testmanager@example.com` |
| Employee email | `testemployee@example.com` |
| Duplicate email (for error tests) | `testowner@example.com` |
| Duplicate phone | `81111111` |

---

## Appendix C — Known Business Rules (Constraints to Test Against)

1. Owner invitation codes are **8 alphanumeric characters**; Manager/Employee codes are **5 numeric digits**.
2. Invitation codes expire **7 days** after creation.
3. A code can only be redeemed **once** — it is marked used after the first redemption.
4. The **primary company** (created during owner registration) cannot be deleted.
5. Managers and Employees must be assigned to a **department**; Owners are not assigned to departments.
6. An Employee invitation **requires a department** to be selected; a reporting manager is optional (send can proceed even with no manager selected, but the UI disables send when a department is selected and has no managers at all).
7. Phone matching is **format-flexible**: `91234567`, `+6591234567`, and `6591234567` are treated as the same phone number.
8. During sign-in, the app stores `tasking_company_id_<userId>` (user-scoped), not a single global key.
9. The team page always shows the company **owner** even if the owner's `users.company_id` does not match the queried company.
10. Role display mapping in Team UI: `Owner` → "Owner / Partner"; the invite modal displays `Owner` role as "Partner".
