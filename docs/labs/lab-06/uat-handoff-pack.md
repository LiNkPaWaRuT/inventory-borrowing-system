# Inventory & Borrowing System — Sprint 1 UAT Handoff Pack

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)  
**Milestone:** Lab 6 — Independent User Acceptance Testing & Defect Management  
**Product Team:** Section 31 • Team Egoist | **App Theme:** Theme 2: Inventory & Equipment Borrowing System  
**Authors:** Pawarut Kumnungwut (67070503422) & Kawinpob Amnuaywittayakul (67070503403)  
**Live Deployed URL:** https://inventory-service-x6zw5ksjsa-as.a.run.app  
**GitHub Repository:** https://github.com/LiNkPaWaRuT/inventory-borrowing-system  

---

## 1. Tested Baseline & Environment Details

| Target Attribute | Specification / Verified Value |
| :--- | :--- |
| **Application Name** | Inventory & Borrowing System (Department Lab Equipment Kiosk) |
| **Production Cloud URL** | https://inventory-service-x6zw5ksjsa-as.a.run.app |
| **Baseline Release & SHA** | `Release Sprint 1 / Lab 5` (Commit: `5caaaaa688ecc05123540ff5061235687a839a95` / short `5caaaaa`) |
| **Visual Title** | `Department Inventory & Equipment Borrowing` |
| **Hosting Infrastructure** | Google Cloud Platform: Cloud Run Serverless Container (`inventory-service`) + Cloud SQL PostgreSQL 16 (`inventory-db`) |

---

## 2. Sprint 1 Acceptance Scope Contract

### In-Scope (Assessed for Sprint 1 Acceptance):
- **Authentication & RBAC:** Borrower login, Custodian login, token issuance (JWT), role-based view enforcement, and session termination.
- **Equipment Catalog:** Real-time hardware listing, item categories, serial numbers, and availability indicators (`Available` vs `Checked Out`).
- **Borrowing Request Workflow:** Borrower submits checkout request for an available lab item; system transitions state from `AVAILABLE` to `REQUESTED`.
- **Single-Item Exclusivity (BR-01 / BR-02):** Strict transactional boundary rejection when an item is already checked out or requested.
- **Custodian Management:** Review pending equipment requests, approve checkouts transitioning state to `ACTIVE`, and monitor department assets.
- **Data Persistence:** Active loans and equipment statuses persist durably in Cloud SQL PostgreSQL across page reloads, container restarts, and redeployments.

### Out-of-Scope (Not Assessed in Sprint 1):
- Item returns & check-in condition grading (Sprint 2 Feature F-03).
- Due date overdue penalty calculations & email notifications (Sprint 2 Feature F-04).
- Multi-item batch borrowing and barcode hardware scanning (Sprint 3).

---

## 3. Safe Synthetic Test Accounts

| Account Label | System Role | Email Username | Key Permitted Operations |
| :--- | :--- | :--- | :--- |
| **Test Custodian** | `CUSTODIAN` | `custodian@example.com` | Access Custodian Management Dashboard, view pending requests, approve checkouts, inspect all active loans. |
| **Test Borrower 1** | `BORROWER` | `borrower1@example.com` | Browse equipment catalog, submit borrow requests, inspect personal loan history (`My Loan Requests & History`). |
| **Test Borrower 2** | `BORROWER` | `borrower2@example.com` | Independent borrower account used to verify data isolation and exclusivity conflicts. |

> 🔒 **Security Notice for Testers:**  
> The actual test password will be shared privately via the course handoff chat. (Do not commit or publish plain passwords in public repositories).

---

## 4. Executable UAT Test Cases

### Case UAT-INV-01: Normal Equipment Request & Custodian Checkout
- **Category:** `Category 1: Normal Domain Journey`
- **Sprint 1 Ref:** SRS REQ-02, REQ-03 | AC-07, AC-08, AC-12 | **Role:** `BORROWER` (`borrower1@example.com`) $\rightarrow$ `CUSTODIAN` (`custodian@example.com`)
- **Purpose:** Verify the complete happy path: Borrower requests available equipment, and Custodian approves physical checkout.
- **Preconditions:** Live service online; item `Digital Oscilloscope DS1054Z` (SN: `OSC-2026-001`) or `Raspberry Pi 4 Model B (8GB)` (SN: `RPI-2026-002`) is `Available`.
- **Synthetic Inputs:** Equipment item `Raspberry Pi 4 Model B (8GB)`.
- **Step-by-Step Actions:**
  1. Open https://inventory-service-x6zw5ksjsa-as.a.run.app in Chrome.
  2. Sign in as `borrower1@example.com` using the provided test credentials.
  3. Under **Equipment Catalog**, locate `Raspberry Pi 4 Model B (8GB)` and click **"Request Borrow"**.
  4. Verify green banner confirms: *"Successfully requested ... Status is REQUESTED, awaiting Custodian checkout approval."*
  5. Verify the item appears under **My Loan Requests & History** with status `REQUESTED`.
  6. Click **Logout** at top right, then sign in as `custodian@example.com`.
  7. Under **Pending Equipment Requests**, locate the request from Alice Borrower and click **"Approve Checkout"**.
- **Expected Result:** Toast confirms checkout. The request moves to **Active Checked-Out Equipment** with status `ACTIVE`. In the catalog, item availability updates to `Checked Out` (red pill).

---

### Case UAT-INV-02: Boundary Single-Item Exclusivity Enforcement
- **Category:** `Category 2: Business Rule / Boundary`
- **Sprint 1 Ref:** SRS BR-01, BR-02 | AC-09, AC-10 | **Role:** `BORROWER` (`borrower1@example.com` or `borrower2@example.com`)
- **Purpose:** Verify the system enforces single-item exclusivity and strictly prevents duplicate loan requests for equipment already checked out.
- **Preconditions:** Item `Logic Analyzer 16 Channel` (SN: `LA-2026-003`) is currently in status `Checked Out` on active loan.
- **Synthetic Inputs:** Item: `Logic Analyzer 16 Channel` (SN: `LA-2026-003`).
- **Step-by-Step Actions:**
  1. Sign in as `borrower1@example.com`.
  2. In **Equipment Catalog**, inspect the row for `Logic Analyzer 16 Channel`.
  3. Verify availability badge displays `Checked Out` (red pill).
  4. Inspect the **Action** column for this row: the request button must be disabled/greyed out with the label **"Unavailable"**.
  5. *(Optional API Boundary Test)*: Attempt to send a direct POST request to `/api/loans/request` for this item:
     ```bash
     curl -i -X POST https://inventory-service-x6zw5ksjsa-as.a.run.app/api/loans/request \
       -H "Content-Type: application/json" \
       -H "Authorization: Bearer <BORROWER_JWT>" \
       -d '{"itemId":"<LOGIC_ANALYZER_ITEM_ID>"}'
     ```
- **Expected Result:** The UI completely blocks request initiation by disabling the button. Direct API invocation returns HTTP 409 Conflict with message `"Item is already checked out or has an active request."` No duplicate loan record is created.

---

### Case UAT-INV-03: Forbidden Role & Administrative Segregation
- **Category:** `Category 3: Forbidden Role / Access`
- **Sprint 1 Ref:** SRS BR-03, NFR-02 | AC-04, AC-05 | **Role:** `BORROWER` (`borrower1@example.com`)
- **Purpose:** Verify role segregation (RBAC): borrowers cannot access custodian administration endpoints or execute checkout approvals.
- **Preconditions:** Valid borrower JWT token.
- **Step-by-Step Actions:**
  1. Sign in as Borrower (`borrower1@example.com`).
  2. Verify that **Pending Equipment Requests** and **Approve Checkout** controls are NOT rendered in the borrower UI.
  3. Send unauthorized GET request to custodian queue endpoint:
     ```bash
     curl -i https://inventory-service-x6zw5ksjsa-as.a.run.app/api/custodian/loans \
       -H "Authorization: Bearer <BORROWER_JWT>"
     ```
  4. Send unauthorized POST request to approve a loan:
     ```bash
     curl -i -X POST https://inventory-service-x6zw5ksjsa-as.a.run.app/api/loans/test-loan-id/checkout \
       -H "Authorization: Bearer <BORROWER_JWT>"
     ```
- **Expected Result:** Server strictly rejects unauthorized access with HTTP 403 Forbidden: `{"success":false,"error":{"code":"AUTH_FORBIDDEN","message":"Operation requires role: CUSTODIAN"}}`. Custodian operational queues remain protected.

---

### Case UAT-INV-04: Loan State & Database Persistence Across Container Reload
- **Category:** `Category 4: State / Persistence`
- **Sprint 1 Ref:** SRS REQ-04, NFR-01 | **Role:** `BORROWER` (`borrower1@example.com`)
- **Purpose:** Verify placed loan requests and item states persist durably in Google Cloud SQL PostgreSQL across session sign-out, browser reloads, and container recycles.
- **Preconditions:** At least one active or requested loan exists (from Case UAT-INV-01).
- **Step-by-Step Actions:**
  1. In the top navigation bar, click **"Logout"**.
  2. Perform a hard browser reload (`Cmd + Shift + R` or `Ctrl + F5`).
  3. Sign back in using `borrower1@example.com`.
  4. Inspect the **My Loan Requests & History** table.
- **Expected Result:** All previously created loan records remain intact with exact Loan ID, item title, serial number, submission timestamp, and current approval status. State is not lost.

---

### Case UAT-INV-05: Custodian Queue Intake & Atomic State Transition
- **Category:** `Domain State Machine Journey`
- **Sprint 1 Ref:** SRS REQ-03 | AC-12 | **Role:** `CUSTODIAN` (`custodian@example.com`)
- **Purpose:** Verify Custodian can review the pending queue and atomically transition a loan from `REQUESTED` to `ACTIVE`.
- **Preconditions:** A loan exists in `REQUESTED` status.
- **Step-by-Step Actions:**
  1. Sign in using `custodian@example.com`.
  2. Under **Pending Equipment Requests**, observe the real-time pending count badge (e.g. `(1)`).
  3. Click **"Approve Checkout"** on the requested item.
  4. Verify the pending counter decrements, and the item moves into **Active Checked-Out Equipment**.
  5. Sign back in as Borrower (`borrower1@example.com`) and verify status in **My Loan Requests & History** transitions to `ACTIVE`.
- **Expected Result:** Real-time atomic transition from `REQUESTED` $\rightarrow$ `ACTIVE`. Item exclusivity is locked across both Borrower and Custodian views.

---

## 5. How to Report Defects (For UAT Partner Team)

If you encounter unexpected behavior, please log a defect on our GitHub repository:
- **Defect Submission URL:** https://github.com/LiNkPaWaRuT/inventory-borrowing-system/issues/new
- **Title Format:** `[UAT Defect] <Short Summary>` (add label `defect` or `lab6`)
- **Required Details:**
  1. Linked Case ID (e.g. `UAT-INV-01`)
  2. Reporter Name & Team
  3. Steps to Reproduce
  4. Expected Result vs. Actual Result
  5. Severity (`Critical` / `Major` / `Minor`)
  6. Screenshot / HTTP response snippet

---

## 6. Official Sprint 1 UAT Acceptance Sign-Off Template

```text
========================================================================================
OFFICIAL SPRINT 1 UAT ACCEPTANCE SIGN-OFF
========================================================================================
Product Name: Inventory & Equipment Borrowing System
Product Team: Section 31, Team Egoist (Pawarut Kumnungwut & Kawinpob Amnuaywittayakul)
Tested Release Commit: 5caaaaa688ecc05123540ff5061235687a839a95 (Release v1.0-cloud)
Live Cloud URL: https://inventory-service-x6zw5ksjsa-as.a.run.app

UAT Testing Team: ______________________________________________________________________
Lead UAT Testers: _____________________________________________ • Date: ________________

Final UAT Decision (Select One):
[ ] ACCEPTED: All critical and major UAT cases pass cleanly without blocking defects.
[ ] ACCEPTED WITH MINOR LIMITATIONS: Core journeys pass; minor non-blocking issues noted.
[ ] NOT ACCEPTED: Critical defects remain unresolved or required test journeys fail.

UAT Sign-off Notes:
________________________________________________________________________________________
________________________________________________________________________________________
========================================================================================
```

