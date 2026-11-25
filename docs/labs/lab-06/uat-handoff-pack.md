# Inventory & Borrowing Sprint 1 — User Acceptance Testing (UAT) Handoff Pack

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)  
**Milestone:** Lab 6 — Independent User Acceptance Testing & Defect Management  
**Product Team:** Section 31 • Team Egoist | **App Theme:** Theme 2: Inventory & Borrowing System  
**Authors:** Pawarut Kumnungwut (67070503422) & Kawinpob Amnuaywittayakul (67070503403)  
**Live Deployed URL:** [https://inventory-service-x6zw5ksjsa-as.a.run.app](https://inventory-service-x6zw5ksjsa-as.a.run.app)  
**GitHub Repository:** [https://github.com/LiNkPaWaRuT/inventory-borrowing-system](https://github.com/LiNkPaWaRuT/inventory-borrowing-system)  

---

## 1. Tested Baseline & Environment Details

| Target Attribute | Specification / Verified Value |
| :--- | :--- |
| **Application Name** | Inventory & Equipment Borrowing System (Department Lab Kiosk) |
| **Production Cloud URL** | `https://inventory-service-x6zw5ksjsa-as.a.run.app` |
| **Baseline Release & SHA** | Release Sprint 1 / Lab 5 Baseline<br>**Commit SHA:** `f89023add2051fb64c5f241663037dd8d0ee91de` (`short f89023a`) |
| **Visual Version Marker** | Header Navigation Title: `Department Inventory & Equipment Borrowing` |
| **Hosting Infrastructure** | Google Cloud Platform: Cloud Run Serverless Container (`inventory-service`) + Cloud SQL PostgreSQL 16 (`inventory-db`) in `asia-southeast1` |

---

## 2. Sprint 1 Acceptance Scope Contract

### In-Scope (Assessed for Sprint 1 Acceptance):
- **Authentication & RBAC:** Borrower login, Custodian login, secure JWT token issuance, role-based navigation and view enforcement, and clean session termination.
- **Catalog & Inventory:** Real-time hardware listing, item categories, serial numbers, and availability badges (`Available` vs `Checked Out`).
- **Borrowing Request Workflow:** Borrower submits checkout request for an available lab item; system transitions state from `AVAILABLE` to `REQUESTED`.
- **Inventory Bounds & Exclusivity (BR-01 / BR-02):** Strict system rejection when attempting to borrow equipment already requested or on active loan.
- **Order & Loan Persistence:** Active loans, requests, and item availability persisted durably in Cloud SQL PostgreSQL across session reloads, container scaling, and restarts.
- **Custodian Dashboard:** Real-time queue intake and status advancement (`REQUESTED` → `ACTIVE` confirmation checkout).

### Out-of-Scope (Not Assessed in Sprint 1 — Deferred to Future Sprints):
- Equipment check-in, return flow, and physical condition grading (Sprint 2 / F-03).
- Due date overdue penalty and fine calculations (Sprint 2 / F-04).
- Multi-item batch borrowing and barcode/QR scanner integration (Sprint 3).

---

## 3. Safe Synthetic Test Accounts

> **Security Note:** In compliance with Lab 6 security standards, accounts use synthetic data and passwords are **never published in Git or public PDFs**. Credentials are communicated privately to the UAT team via the official course channel.

| Account Label | System Role | Email Username | Password | Key Permitted Operations |
| :--- | :---: | :--- | :---: | :--- |
| **Test Custodian** | `CUSTODIAN` | `custodian@example.com` | *Shared Privately* | Access Custodian Queue, view pending requests,<br>approve checkouts, and inspect active loans. |
| **Test Borrower 1** | `BORROWER` | `borrower1@example.com` | *Shared Privately* | Browse catalog, submit borrow requests,<br>and inspect personal loan history. |
| **Test Borrower 2** | `BORROWER` | `borrower2@example.com` | *Shared Privately* | Independent borrower for ownership isolation,<br>privacy boundaries, and exclusivity collisions. |

---

## 4. Data Baseline, Reset Instructions & Execution Sequence

| Control Item | Specification & Instructions |
| :--- | :--- |
| **Pre-seeded Items** | • `Raspberry Pi 4 Model B (8GB)` (SN: `RPI-2026-002`) — **Status:** `Available`<br>• `Logic Analyzer 16 Channel` (SN: `LA-2026-003`) — **Status:** `Checked Out`<br>• `Digital Storage Oscilloscope` (SN: `DSO-2026-001`) — **Status:** `Available` |
| **Execution Order** | Execute sequentially: $\text{UAT-INV-01} \longrightarrow \text{02} \longrightarrow \text{03} \longrightarrow \text{04} \longrightarrow \text{05}$<br>*(Note: `UAT-INV-04` validates persistence of the loan created in `UAT-INV-01`).* |
| **Reset / Cleanup** | If baseline restoration is required, contact Product Team (`Team Egoist`) via the course chat to trigger the 30-second Cloud Run migration/re-seed job. |

---

## 5. Executable UAT Test Cases

### Case UAT-INV-01: Normal Equipment Request & Custodian Checkout
- **Category:** Category 1: Normal Domain Journey
- **Sprint 1 Ref:** SRS REQ-02, REQ-03, AC-05, AC-08
- **Role:** `BORROWER` (`borrower1@example.com`) & `CUSTODIAN` (`custodian@example.com`)
- **Purpose:** Verify the end-to-end happy path: a borrower requests an available item, and a custodian approves and checks it out.
- **Preconditions:** Live service is accessible; equipment item `Raspberry Pi 4 Model B (8GB)` is in `Available` status.
- **Synthetic Inputs:** Equipment item: `Raspberry Pi 4 Model B (8GB)` (SN: `RPI-2026-002`).

**Step-by-Step Actions:**
1. Open `https://inventory-service-x6zw5ksjsa-as.a.run.app` in Chrome.
2. Sign in using `borrower1@example.com` with provided credentials.
3. Under **Equipment Catalog**, locate `Raspberry Pi 4 Model B (8GB)` and click **"Request Borrow"**.
4. Confirm the prompt if modal appears; verify toast notification indicates: *"Successfully requested ... Status is REQUESTED, awaiting Custodian checkout approval."*
5. Scroll down to **My Loan Requests & History**; verify the item appears with status `REQUESTED`.
6. Click **Logout** in the navigation header.
7. Sign in using `custodian@example.com`.
8. Locate the pending request under **Pending Equipment Requests** and click **"Approve Checkout"**.

**Expected Result:**
- Success toast confirms checkout approval.
- In Custodian view, the request moves to **Active Checked-Out Equipment** with status `ACTIVE`.
- In Equipment Catalog, `Raspberry Pi 4 Model B (8GB)` availability updates from `Available` to `Checked Out` (red badge), and its action button becomes disabled.

---

### Case UAT-INV-02: Boundary Single-Item Exclusivity Enforcement
- **Category:** Category 2: Business Rule / Boundary
- **Sprint 1 Ref:** SRS BR-01, BR-02, REQ-02
- **Role:** `BORROWER` (`borrower1@example.com`)
- **Purpose:** Verify database exclusivity rules prevent duplicate borrow requests when an item is already requested or active.
- **Preconditions:** Item `Logic Analyzer 16 Channel` is currently on active loan (status: `Checked Out`).
- **Synthetic Inputs:** Equipment item: `Logic Analyzer 16 Channel` (SN: `LA-2026-003`).

**Step-by-Step Actions:**
1. Sign in as `borrower1@example.com` and navigate to **Equipment Catalog**.
2. Locate `Logic Analyzer 16 Channel` and inspect its status badge (`Checked Out`).
3. Inspect the Action column: verify the button is disabled and displays **"Unavailable"**.
4. Attempt to bypass the UI constraint by dispatching a direct POST request via terminal:
   ```bash
   curl -i -X POST https://inventory-service-x6zw5ksjsa-as.a.run.app/api/loans/request \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <BORROWER_JWT_TOKEN>" \
     -d '{"itemId": "la-2026-003"}'
   ```
   *(Note: `<BORROWER_JWT_TOKEN>` can be copied from Chrome DevTools → Application → Local Storage → `auth_token`).*

**Expected Result:**
- UI strictly prevents submission with disabled state.
- Direct API invocation is rejected with HTTP `409 Conflict` (or `400 Bad Request`) containing error message: *"Item is already checked out or has an active request."*
- No duplicate loan record is created in the database.

---

### Case UAT-INV-03: Forbidden Role Access & Cross-User Ownership Isolation
- **Category:** Category 3: Forbidden Role / Ownership & Cross-User Isolation
- **Sprint 1 Ref:** SRS BR-03, NFR-02, REQ-01
- **Role:** `BORROWER` (`borrower1@example.com` & `borrower2@example.com`)
- **Purpose:** Verify standard borrowers cannot access Custodian management endpoints, and verify that borrowers cannot view or tamper with other borrowers' loan records.
- **Preconditions:** Both `borrower1` and `borrower2` have valid credentials; `borrower1` has at least one active/pending loan.
- **Synthetic Inputs:** Endpoint URLs `/api/custodian/loans` and `/api/loans/:id/checkout`.

**Step-by-Step Actions:**
1. Sign in as `borrower1@example.com`.
2. Inspect the UI navigation bar: verify **Custodian Queue** and approval buttons are NOT rendered.
3. Open Chrome DevTools (`F12`), navigate to **Application** → **Local Storage** → `https://inventory-service-x6zw5ksjsa-as.a.run.app`, and copy the value of `auth_token`.
4. Send an unauthorized GET request to the custodian-only API endpoint:
   ```bash
   curl -i -H "Authorization: Bearer <BORROWER_JWT_TOKEN>" \
     https://inventory-service-x6zw5ksjsa-as.a.run.app/api/custodian/loans
   ```
5. Send an unauthorized mutation request to force approval of a loan:
   ```bash
   curl -i -X POST -H "Authorization: Bearer <BORROWER_JWT_TOKEN>" \
     https://inventory-service-x6zw5ksjsa-as.a.run.app/api/loans/dummy-loan-id/checkout
   ```
6. **Cross-User Ownership Verification:** Click **Logout**, then sign in as **Test Borrower 2** (`borrower2@example.com`).
7. Inspect the **My Loan Requests & History** table.

**Expected Result:**
- API requests in Steps 4 & 5 strictly return **HTTP 403 Forbidden** (`{"success":false,"error":{"code":"AUTH_FORBIDDEN"}}`). Custodian queue data is never exposed to borrowers.
- In Step 7, Borrower 2's loan table is completely isolated: Borrower 1's loans and items are NOT visible to Borrower 2.

---

### Case UAT-INV-04: Loan State Persistence Across Session Reload
- **Category:** Category 4: State / Persistence
- **Sprint 1 Ref:** SRS REQ-04, NFR-01
- **Role:** `BORROWER` (`borrower1@example.com`)
- **Purpose:** Verify that active and requested loans persist durably in Cloud SQL PostgreSQL across session logout and full browser reloads.
- **Sequence Dependency:** Must be executed after `UAT-INV-01`.
- **Preconditions:** At least one active or requested loan exists for `borrower1@example.com`.
- **Synthetic Inputs:** User actions: Logout, hard reload (`Cmd+Shift+R` or `Ctrl+F5`), and re-login.

**Step-by-Step Actions:**
1. In the top navigation header, click the **"Logout"** button.
2. Perform a hard browser refresh (`Cmd + Shift + R` on macOS, or `Ctrl + F5` on Windows).
3. Sign back in using `borrower1@example.com`.
4. Inspect the **My Loan Requests & History** table.

**Expected Result:**
- Previously submitted loan records remain intact with identical Loan ID, item title, serial number, submission timestamp, and current status (`ACTIVE` or `REQUESTED`).
- Data is not lost or reverted upon session restart.

---

### Case UAT-INV-05: Custodian Queue Intake & State Advancement
- **Category:** Domain State Machine Journey
- **Sprint 1 Ref:** SRS REQ-03, AC-12
- **Role:** `CUSTODIAN` (`custodian@example.com`) & `BORROWER` (`borrower1@example.com`)
- **Purpose:** Verify that Custodian reviews incoming requests in real time and advances the domain state machine from `REQUESTED` to `ACTIVE`.
- **Preconditions:** A borrow request exists in `REQUESTED` status.
- **Synthetic Inputs:** Custodian approval action on active queue item.

**Step-by-Step Actions:**
1. Sign in using `custodian@example.com`.
2. Inspect the **Pending Equipment Requests** dashboard; verify the pending badge counter increments for new requests.
3. Review item details and click **"Approve Checkout"**.
4. Log out and sign in as `borrower1@example.com`.
5. Check **My Loan Requests & History**.

**Expected Result:**
- Custodian UI updates immediately: item moves from **Pending Requests** to **Active Checked-Out Equipment**.
- Borrower UI reflects state transition to `ACTIVE` with verified checkout timestamp.

---

## 6. How to Report Defects (For UAT Partner Team)

If you encounter unexpected behavior, UI glitches, or specification violations, please submit an issue on our GitHub repository:
- **Defect Submission URL:** [https://github.com/LiNkPaWaRuT/inventory-borrowing-system/issues/new](https://github.com/LiNkPaWaRuT/inventory-borrowing-system/issues/new)
- **Title Format:** `[UAT Defect] <Short Summary>`
- **Labels:** `defect`, `lab6`
- **Required Information:**
  1. **Linked Case ID:** (e.g. `UAT-INV-02`) or SRS requirement reference.
  2. **Reporter Name & Team:** e.g. Team Name / Student Name.
  3. **Tested Revision / Commit:** Commit SHA or Cloud Run URL tested.
  4. **Steps to Reproduce:** Exact sequence of clicks or API calls.
  5. **Expected vs. Actual Result:** What should happen vs. what actually occurred.
  6. **Severity Level:** 
     - **Critical:** Crash, data loss, security bypass, or complete blocker.
     - **Major:** Core requirement failure with no workaround.
     - **Minor:** UI formatting, minor phrasing, or cosmetic issue.
  7. **Supporting Evidence:** Screenshot, terminal curl output, or browser console log.

---

## 7. Official Sprint 1 UAT Acceptance Sign-Off Template

```text
========================================================================================
                   SPRINT 1 UAT ACCEPTANCE DECISION SIGN-OFF
========================================================================================

Product Name:            Inventory & Equipment Borrowing System
Product Team:            Section 31, Team Egoist (Pawarut Kumnungwut & Kawinpob Amnuaywittayakul)
Tested Release Commit:   f89023add2051fb64c5f241663037dd8d0ee91de (short f89023a)
Tested Environment URL:  https://inventory-service-x6zw5ksjsa-as.a.run.app

UAT Testing Team:        _______________________________________________________________
Lead UAT Testers:        _______________________________________________________________
Date of Testing:         _______________________________________________________________

Final UAT Decision (Please select exactly one):

  [ ] ACCEPTED
      All critical and major UAT test cases pass cleanly without release-blocking defects.

  [ ] ACCEPTED WITH MINOR LIMITATIONS
      Core Sprint 1 domain journeys pass; minor non-blocking issues or known limitations 
      are documented and agreed upon.

  [ ] NOT ACCEPTED
      One or more critical/major defects remain unresolved, or required test journeys 
      are BLOCKED.

UAT Sign-off Notes & Findings Summary:
________________________________________________________________________________________
________________________________________________________________________________________
________________________________________________________________________________________

Independent Tester Signature: ___________________________    Date: _____________________
========================================================================================
```
