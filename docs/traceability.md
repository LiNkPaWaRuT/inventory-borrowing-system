# Feature Traceability Matrix

This matrix establishes complete traceability from Baseline Requirements (FR, BR, NFR) to Features, Planned Sprints, Acceptance Criteria (AC), and Software Test Specifications (STS).

| Req ID | Requirement Summary | Feature ID | Feature Title | Target Sprint | Acceptance Criteria (AC) | Test Specification (STS) | Verification Method |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FR-01** | User authentication with login/logout | `F-01` | Auth & Access Control | Sprint 1 | `AC-01`, `AC-02`, `AC-03` | `TEST-AUTH-01`, `TEST-AUTH-02` | Automated API (Supertest) + UI |
| **FR-02** | Current user identity & role resolution | `F-01` | Auth & Access Control | Sprint 1 | `AC-01`, `AC-04` | `TEST-AUTH-03` | Automated API (Supertest) |
| **FR-03** | Browse catalog with availability state | `F-02` | Item Catalog & Request | Sprint 1 | `AC-07` | `TEST-LOAN-01` | Automated API + React UI |
| **FR-04** | Borrower submits loan request | `F-02` | Item Catalog & Request | Sprint 1 | `AC-08` | `TEST-LOAN-01` | Automated API + Integration Test |
| **FR-05** | Custodian approves checkout | `F-02` | Item Catalog & Request | Sprint 1 | `AC-12` | `TEST-LOAN-03` | Automated API + Integration Test |
| **FR-06** | Borrower views personal loans | `F-02` | Item Catalog & Request | Sprint 1 | `AC-08`, `AC-11` | `TEST-LOAN-05` | Automated API + React UI |
| **FR-07** | Custodian views all system loans | `F-02` | Item Catalog & Request | Sprint 1 | `AC-12` | `TEST-LOAN-03` | Automated API + React UI |
| **BR-01** | Single-item exclusivity (no double-book) | `F-02` | Item Catalog & Request | Sprint 1 | `AC-09` | `TEST-LOAN-02` | Automated API (Supertest) |
| **BR-02** | Prevent duplicate active loans for item | `F-02` | Item Catalog & Request | Sprint 1 | `AC-10` | `TEST-LOAN-02` | Automated API (Supertest) |
| **BR-03** | Role segregation (Custodian only checkout)| `F-01`, `F-02` | Auth & Loan Workflow | Sprint 1 | `AC-05` | `TEST-LOAN-04` | Automated API (Supertest) |
| **BR-04** | Per-borrower concurrent loan quota (max 2)| `F-02` | Loan Request Lifecycle | Lab 7 (Maint) | `AC-13`, `AC-14` | `TEST-L7-01` | Automated API Integration Test |
| **BR-05** | Ownership isolation (cross-borrower block)| `F-02` | Item Catalog & Request | Sprint 1 | `AC-11` | `TEST-LOAN-05` | Automated API (Supertest) |
| **NFR-01** | Passwords hashed using bcrypt | `F-01` | Auth & Access Control | Sprint 1 | `AC-06` | `TEST-AUTH-05` | Automated Unit Test (Prisma seed/hash) |
| **NFR-02** | Protected routes reject unauthenticated | `F-01` | Auth & Access Control | Sprint 1 | `AC-04` | `TEST-AUTH-03` | Automated API (Supertest) |
| **NFR-03** | API responses within 300ms | `F-01`, `F-02` | System Baseline | Sprint 1 | `AC-01`, `AC-08` | `TEST-PERF-01` | Automated Benchmark / Test suite timing |
| **FR-08** | Equipment return & condition grading | `F-03` | Return & Check-in | Sprint 2 | `AC-15`, `AC-16`, `AC-17` | `TEST-RET-01`, `TEST-RET-02`, `TEST-RET-03` | Automated API (Supertest) + UI |
| **FR-09** | Due dates & overdue calculation | `F-04` | Due Date Management | Sprint 2 | `AC-18`, `AC-19` | `TEST-DUE-01`, `TEST-DUE-02` | Automated Unit/API |
| **FR-10** | Multi-item batch borrowing | `F-05` | Batch Requests | Sprint 3 | `AC-20`, `AC-21`, `AC-22` | `TEST-BAT-01`, `TEST-BAT-02` | Automated API + UI |
| **FR-11** | Item search and category filtering | `F-06` | Catalog Search & Filter | Sprint 3 | Planned | TBD (Sprint 3 Final) | React UI + API query |
| **FR-12** | Audit log & inventory reporting export | `F-07` | Inventory Reporting | Sprint 3 | Planned | TBD (Sprint 3 Final) | Automated System Test |

---

## Software Test Specification (STS) - Maintenance Addendum

### TEST-L7-01: Boundary Verification for Borrower 2-Loan Quota
- **Target Requirements:** `BR-04`, `AC-13`, `AC-14`
- **Execution Engine:** Vitest + Supertest
- **Preconditions:**
  1. Authenticated as synthetic borrower (`borrower1@example.com`).
  2. Database contains at least 3 distinct available inventory items (Item A, Item B, Item C).
  3. Borrower currently holds 0 active or pending loans.
- **Test Steps & Assertions:**
  1. **Boundary Count 0 -> 1:** Send `POST /api/loans/request` for Item A.
     - Expected: HTTP `201 Created`, loan record created with status `REQUESTED` (`AC-13`).
  2. **Boundary Count 1 -> 2:** Send `POST /api/loans/request` for Item B.
     - Expected: HTTP `201 Created`, loan record created with status `REQUESTED` (`AC-13`).
  3. **Boundary Exceeded Count 2 -> 3:** Send `POST /api/loans/request` for Item C.
     - Expected: HTTP `409 Conflict`, JSON response `{"error": "LOAN_LIMIT_EXCEEDED", "message": "Borrower has reached the maximum limit of 2 concurrent loans (pending or active)."}` (`AC-14`).
  4. **State Integrity Verification:**
     - Query database for loans of Item C $\to$ assert no loan record exists.
     - Query borrower's loans $\to$ assert total active/pending loan count remains strictly 2.

### TEST-RET-01: Equipment Return with GOOD/FAIR Condition (Sprint 2 / F-03)
- **Target Requirements:** `FR-08`, `BR-06`, `AC-15`
- **Execution Engine:** Vitest + Supertest
- **Preconditions:** Loan is in `ACTIVE` status for Item X.
- **Steps & Assertions:**
  1. Custodian sends `POST /api/loans/:id/return` with `{ conditionGrade: "GOOD", returnNotes: "All parts intact" }`.
  2. Assert HTTP `200 OK`.
  3. Assert Loan status updated to `RETURNED`.
  4. Assert Item X availability is restored to `true` and status `AVAILABLE`.
  5. Assert borrower's active loan quota count decrements by 1.

### TEST-RET-02: Equipment Return with DAMAGED Condition Quarantine (Sprint 2 / F-03)
- **Target Requirements:** `FR-08`, `BR-07`, `AC-16`
- **Execution Engine:** Vitest + Supertest
- **Preconditions:** Loan is in `ACTIVE` status for Item Y.
- **Steps & Assertions:**
  1. Custodian sends `POST /api/loans/:id/return` with `{ conditionGrade: "DAMAGED", returnNotes: "Cracked display" }`.
  2. Assert HTTP `200 OK`.
  3. Assert Loan status updated to `RETURNED`.
  4. Assert Item Y availability remains `false` and status is set to `MAINTENANCE`.

### TEST-RET-03: Security Guard - Borrower Return Rejection (Sprint 2 / F-03)
- **Target Requirements:** `BR-06`, `AC-17`
- **Execution Engine:** Vitest + Supertest
- **Preconditions:** Active loan exists.
- **Steps & Assertions:**
  1. Borrower sends `POST /api/loans/:id/return`.
  2. Assert HTTP `403 Forbidden` (`FORBIDDEN_ROLE`).

### TEST-BAT-01: Multi-Item Batch Request Atomic Success (Sprint 3 / F-05)
- **Target Requirements:** `FR-10`, `BR-09`, `AC-20`
- **Execution Engine:** Vitest + Supertest
- **Preconditions:** Borrower has 0 active loans; Item A and Item B are available.
- **Steps & Assertions:**
  1. Borrower sends `POST /api/loans/batch` with `{ itemIds: [itemA.id, itemB.id] }`.
  2. Assert HTTP `201 Created` returning 2 loan records.
  3. Assert borrower active quota is now 2/2.

### TEST-BAT-02: Batch Request Quota Rejection & Rollback (Sprint 3 / F-05)
- **Target Requirements:** `BR-04`, `BR-09`, `AC-21`
- **Execution Engine:** Vitest + Supertest
- **Preconditions:** Borrower has 1 existing active loan; submits batch of 2 items (total 3 > 2).
- **Steps & Assertions:**
  1. Borrower sends `POST /api/loans/batch` with 2 items.
  2. Assert HTTP `409 Conflict` (`LOAN_LIMIT_EXCEEDED`).
  3. Assert database loan count for borrower remains strictly 1 (atomic rollback).
