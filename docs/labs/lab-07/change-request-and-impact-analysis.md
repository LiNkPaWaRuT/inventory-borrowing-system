# Lab 7 Part A — Change Request & System Impact Analysis

**Course:** CPE 334 Introduction to Software Engineering in the Age of AI Agents (Semester 1/2026)  
**Milestone:** Lab 7 Part A — Software Maintenance Metrics & Release Readiness ([L7-01])  
**Product Team:** Section 31 • Team Egoist | **App Theme:** Theme 2: Inventory & Borrowing System  
**Authors:** Kawinpob Amnuaywittayakul (67070503403) & Pawarut Kumnungwut (67070503422)  
**Live Deployed URL:** [https://inventory-service-x6zw5ksjsa-as.a.run.app](https://inventory-service-x6zw5ksjsa-as.a.run.app)  
**GitHub Repository:** [https://github.com/LiNkPaWaRuT/inventory-borrowing-system](https://github.com/LiNkPaWaRuT/inventory-borrowing-system)  
**Accepted Sprint 1 Baseline & Pre-Change Commit:** `6a19bd1a66275c977f62e8ea5b106263725cf9a9` (short: `6a19bd1`)

---

## 1. Change Request Specification (`CR-L7-01`)

### 1.1 Identification & Scope
- **Change Request ID:** `CR-L7-01` (Option A — Per-Borrower Concurrent Loan Quota)
- **Target Feature:** `F-02`: Item Catalog, Loan Request, and Custodian Checkout Workflow
- **Maintenance Type:** Adaptive Maintenance (requirement evolution on previously accepted Sprint 1 functionality)
- **Baseline Reference:** Commit `6a19bd1` (Sprint 1 Release baseline accepted after Lab 6 UAT defect resolution)

### 1.2 Original Sprint 1 Rule vs. Proposed New Rule

| Dimension | Original Sprint 1 Rule (`REQ-02` / `BR-01`) | Proposed Maintenance Rule (`BR-04`) |
| :--- | :--- | :--- |
| **Loan Cap** | **Unbounded:** Any authenticated `BORROWER` can request any `AVAILABLE` item. No limit exists on how many concurrent requests or active loans a single borrower may hold simultaneously. | **Bounded (Max 2):** An authenticated `BORROWER` may hold at most **2 concurrent loans** in `REQUESTED` or `ACTIVE` status combined. |
| **Validation Point** | Only validates item availability (`item.isAvailable == true`) and ensures item is not already requested or active. | First counts borrower's existing `REQUESTED` + `ACTIVE` loans. If $\ge 2$, request is immediately rejected before touching item state. |
| **Rejection Response** | N/A for user quota (only rejects with 409 if item itself is unavailable). | Returns **HTTP 409 Conflict** with error code `LOAN_LIMIT_EXCEEDED` and human-readable message. |
| **UI Experience** | Borrow button is always active for any available item regardless of how many items the user currently holds. | Displays borrower's active quota indicator (`X / 2 loans active/requested`). When quota is reached (2/2), displays clear warning banner and handles 409 rejection gracefully. |

### 1.3 Engineering Rationale
In an engineering department lab environment, specialized test hardware (oscilloscopes, logic analyzers, FPGA development kits) is scarce and expensive. Under the original Sprint 1 specification, an individual student could submit requests for an arbitrary number of items, starving other lab members of essential equipment. Introducing a hard cap of 2 concurrent loans per borrower balances student productivity with fair resource distribution while maintaining the integrity of all existing Sprint 1 approval workflows.

### 1.4 Exact Boundaries & Invalid Cases

```
Borrower Active Loan Count (REQUESTED + ACTIVE)
  0 loans  ──► Request Item A  ──► Allowed (HTTP 201 Created)  ──► New Count: 1
  1 loan   ──► Request Item B  ──► Allowed (HTTP 201 Created)  ──► New Count: 2
  2 loans  ──► Request Item C  ──► REJECTED (HTTP 409 Conflict) ──► New Count: 2 (Unchanged)
                                    Code: LOAN_LIMIT_EXCEEDED
                                    No database row inserted
```

- **Boundary Case 1 (0 existing loans):** Submitting a request for an available item succeeds with `HTTP 201 Created`, creating a new loan with status `REQUESTED`. Quota increments to 1/2.
- **Boundary Case 2 (1 existing loan in `REQUESTED` or `ACTIVE`):** Submitting a request for an available item succeeds with `HTTP 201 Created`, creating a new loan with status `REQUESTED`. Quota increments to 2/2.
- **Boundary Case 3 (2 existing loans in `REQUESTED` or `ACTIVE` in any combination):**
  - Combination 2 `REQUESTED`, 0 `ACTIVE`: 3rd request rejected (`HTTP 409 Conflict`).
  - Combination 1 `REQUESTED`, 1 `ACTIVE`: 3rd request rejected (`HTTP 409 Conflict`).
  - Combination 0 `REQUESTED`, 2 `ACTIVE`: 3rd request rejected (`HTTP 409 Conflict`).
  - **Payload:** `{ "error": "LOAN_LIMIT_EXCEEDED", "message": "Borrower has reached the maximum limit of 2 concurrent loans (pending or active)." }`
  - **Database Integrity:** Zero rows inserted into `loans` table.
- **Exclusion of Inactive States:** Historical loans with status `RETURNED` or `CANCELLED` do not count toward the active quota.
- **Borrower Isolation:** Quota is calculated strictly per authenticated borrower identity (`req.user.id`). Other borrowers' requests and loans have zero impact on the user's quota.

### 1.5 Role & Access Expectations
- **`BORROWER` Role:** Enforced during borrow request intake (`POST /api/loans/request`). Borrowers cannot bypass the check via direct API calls or UI interactions.
- **`CUSTODIAN` Role:** Custodians oversee the entire department catalog and process checkouts (`POST /api/custodian/loans/:id/checkout`). Because Custodian checkout advances an already counted `REQUESTED` loan to `ACTIVE`, the total count (`REQUESTED` + `ACTIVE`) remains constant, causing zero side effects on the custodian's workflow.
- **Preserved RBAC:** `requireRole('BORROWER')` and `requireRole('CUSTODIAN')` middleware continue to enforce strict 403 Forbidden boundaries on unauthorized endpoints.

### 1.6 Approval Record
- **Proposed By:** Team Egoist (Kawinpob Amnuaywittayakul & Pawarut Kumnungwut)
- **Approval Date:** 26 November 2026
- **Approval Authority:** CPE 334 Instructor / TA approved under Lab 7 self-selected Sprint 1 adaptive maintenance guidelines.

---

## 2. Comprehensive Impact Analysis Table

The following compact matrix traces the impact of Change Request `CR-L7-01` across the entire system lifecycle, architectural tiers, documentation contracts, and regression protections:

| Impact Dimension | Scope & Artifact Affected | Detailed Impact & Maintenance Action |
| :--- | :--- | :--- |
| **Requirement Specification** | `docs/srs.md` | • Update Section 4 (`REQ-02` Loan Request) to document per-borrower concurrency limit.<br>• Add Business Rule `BR-04` (Max 2 Concurrent Loans per Borrower).<br>• Add Acceptance Criteria `AC-13` (success at $\le 1$ active loan) and `AC-14` (HTTP 409 rejection at $\ge 2$ active loans). |
| **System Architecture & SDS** | `docs/system-sds.md` | • Update Section 3 API Design: Document `POST /api/loans/request` error response `409 Conflict` with error code `LOAN_LIMIT_EXCEEDED`.<br>• Update Section 4 Component Design: Specify `BorrowerDashboard.tsx` loan counter badge, disabled borrow buttons at quota limit, and error banner. |
| **Traceability & Test Matrix** | `docs/traceability.md` | • Map `REQ-02` and `BR-04` to `AC-13`, `AC-14`, and new test case `TEST-L7-01`.<br>• Maintain existing mappings for `BR-01`, `BR-02`, and `BR-03`. |
| **Backend API Route** | `server/src/routes/loans.ts` | • In `router.post('/request', ...)`:<br>Query `prisma.loan.count({ where: { borrowerId: req.user.id, status: { in: ['REQUESTED', 'ACTIVE'] } } })`.<br>• If count $\ge 2$, return `res.status(409).json({ error: 'LOAN_LIMIT_EXCEEDED', message: '...' })`. |
| **Frontend UI View** | `src/pages/BorrowerDashboard.tsx` | • Compute active loan count from borrower's loans (`REQUESTED` + `ACTIVE`).<br>• Render active loan badge indicator (e.g. `Active Loans: 1/2`).<br>• Display user-friendly error banner if API returns 409 `LOAN_LIMIT_EXCEEDED`. |
| **Callers & Dependencies** | Client apps, automated tests, future Sprint 2/3 endpoints | • Only affects callers of `POST /api/loans/request`.<br>• Custodian endpoints (`/api/custodian/*`) and catalog endpoints (`/api/items`) have zero structural dependency on this count check. |
| **UI & API Validation** | Server-side validation (authoritative) + Client feedback (defensive) | • Backend is strictly authoritative to prevent API bypass.<br>• Frontend provides immediate visual feedback to avoid confusing users. |
| **Roles & Ownership** | Authentication middleware (`server/src/middleware/auth.ts`) | • Enforced strictly using `req.user.id` from the verified JWT payload.<br>• Custodian-only routes and Borrower-only routes remain strictly isolated (RBAC). |
| **Persistence & Database** | `prisma/schema.prisma` & PostgreSQL `loans` table | • **No schema migration required.** The existing `loans` table already contains `borrowerId` and `status` columns with an index on `borrowerId`.<br>• Existing historical records in Cloud SQL PostgreSQL naturally participate in the count check without data transformation. |
| **Historical Data Handling** | Existing database records in Cloud SQL | • Any synthetic test borrower with $\ge 2$ active loans will be immediately subject to the quota.<br>• Inactive loans (`RETURNED`, `CANCELLED`) remain excluded. |
| **Preserved Sprint 1 Behaviors** | Entire Sprint 1 Baseline (`6a19bd1`) | • **Single-item exclusivity (`BR-01`/`BR-02`):** Requesting an item that is already `REQUESTED` or `ACTIVE` returns 409.<br>• **Catalog badge states:** Tri-state display (`Available`, `● Pending Review`, `Checked Out`).<br>• **Custodian approval workflow (`REQ-03`):** Custodian transitions `REQUESTED` $\to$ `ACTIVE`.<br>• **RBAC & Isolation (`BR-03`):** Cross-borrower loan inspection and unauthorized checkout return 403 Forbidden. |
| **Regression Test Protection** | `tests/auth.test.ts` & `tests/borrowing.test.ts` | • All existing Sprint 1 tests must pass untouched without weakening or skipping assertions.<br>• `TEST-DEF-01` regression test from Lab 6 remains fully verified. |

---

## 3. Test & Verification Plan

### 3.1 New Test Case Specification (`TEST-L7-01`)
- **Test ID:** `TEST-L7-01` (Boundary Verification for 2-Loan Quota)
- **Target Acceptance Criteria:** `AC-13`, `AC-14`
- **Preconditions:**
  - Authenticated as synthetic borrower (`borrower1@example.com`).
  - At least 3 distinct hardware items exist in `AVAILABLE` state in the database.
- **Execution Steps:**
  1. Submit 1st borrow request for Item 1 $\longrightarrow$ Assert `HTTP 201 Created`, status `REQUESTED`.
  2. Submit 2nd borrow request for Item 2 $\longrightarrow$ Assert `HTTP 201 Created`, status `REQUESTED`.
  3. Submit 3rd borrow request for Item 3 $\longrightarrow$ Assert `HTTP 409 Conflict`, error code `LOAN_LIMIT_EXCEEDED`.
  4. Query database for Item 3 loan records $\longrightarrow$ Assert zero records created for Item 3.
  5. Inspect borrower's loan list $\longrightarrow$ Assert exactly 2 loans exist.

### 3.2 TDD Evidence Collection Plan
1. **RED Phase:** Add `TEST-L7-01` to `tests/borrowing.test.ts` against the untouched pre-change baseline commit `6a19bd1`. Execute `npm test`. Capture the failing output showing HTTP 201 returned instead of HTTP 409 on the 3rd request (proving failure is strictly due to the missing business rule).
2. **GREEN Phase:** Implement the quota count check in `server/src/routes/loans.ts` and UI handling in `src/pages/BorrowerDashboard.tsx`. Re-run `npm test` to capture clean passing results across all 16 test cases (15 existing + 1 new).
3. **Regression Phase:** Run `tests/auth.test.ts` and `tests/borrowing.test.ts` to confirm 100% pass rate with zero skipped or modified legacy assertions.

---

## 4. Part A Sign-Off & Review Record

| Review Item | Specification / Status |
| :--- | :--- |
| **Change Request Document** | `docs/labs/lab-07/change-request-and-impact-analysis.md` |
| **Target Milestone** | Lab 7 Issue 1 ([L7-01]) — Part A Change Impact & Updated Contract |
| **Author / Submitter** | Kawinpob Amnuaywittayakul (`@2addseap`) |
| **Assigned Peer Reviewer** | Pawarut Kumnungwut (`@LiNkPaWaRuT`) |
| **Review Date** | 26 November 2026 |
| **Peer Review Recommendation** | **APPROVED.** The change request is strictly bounded, the impact table is comprehensive, and the pre-change baseline (`6a19bd1`) is unambiguously documented. Ready for contract documents update ([L7-02]). |
