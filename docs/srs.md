# Software Requirements Specification (SRS)
## Theme 2: Inventory and Borrowing System

### 1. Stakeholder Problem & Context
The Computer Engineering Department manages valuable lab equipment, test hardware, microcontroller boards, and specialized development devices. Currently, tracking equipment checkout, availability, and active loans is handled informally or across uncoordinated spreadsheets. This leads to double-allocations, missing inventory, and unverified handoffs.

The **Inventory and Borrowing System** provides a reliable, centralized web platform to govern equipment loans. The system tracks item availability, enables department members to request gear, and ensures only authorized custodians can record and execute physical checkouts.

### 2. Actors & Responsibilities
- **Borrower (Department Member / Student / Faculty):**
  - Authenticates with department credentials.
  - Views the catalog of equipment with real-time availability status.
  - Submits a borrow request for an available item.
  - Views only their own active and historical loan requests.
  - Cannot record checkouts or alter catalog inventory.
- **Custodian (Equipment Administrator / Lab Staff):**
  - Authenticates with administrative privileges.
  - Oversees catalog inventory and equipment availability state.
  - Inspects all incoming loan requests across all borrowers.
  - Approves and records physical equipment checkout to transition requests into active loans.
  - Enforces exclusivity and availability constraints.

### 3. Product Scope & Explicit Exclusions
#### In Scope (Baseline & Evolution):
- Real authentication with password hashing and token lifecycle.
- Role-based authorization for Borrower and Custodian roles.
- Inventory item catalog with item state (`isAvailable`).
- Loan lifecycle: Requesting an item -> Custodian checkout -> Active loan.
- Enforced single-item exclusivity and duplicate prevention.
- Automated API and unit test verification.

#### Explicit Exclusions (Out of Scope for Sprint 1):
- Self-registration / email verification (seeded accounts are used).
- Automated barcode/RFID scanner hardware integration.
- Penalty fines or electronic payment gateways.
- Multi-item bundle checkout (Sprint 1 tracks individual distinct items).
- Third-party email / SMS notification dispatchers (synthetic in-app notifications only).

---

### 4. Functional Requirements (FR)
- **FR-01 (Authentication):** The system shall allow registered users to authenticate securely using email and password, establishing a documented token session.
- **FR-02 (Identity Retrieval):** The system shall provide an endpoint to return the current user's profile and assigned role (`BORROWER` or `CUSTODIAN`).
- **FR-03 (Catalog Inspection):** The system shall permit authenticated borrowers and custodians to retrieve the list of inventory items with their current availability status.
- **FR-04 (Loan Request):** The system shall allow a borrower to submit a loan request for an available inventory item, creating a loan record with status `REQUESTED`, provided the borrower has not reached their maximum concurrent active/pending loan quota.
- **FR-05 (Custodian Checkout):** The system shall allow a custodian to approve a pending loan request, marking the loan as `ACTIVE` and updating the item's availability to false.
- **FR-06 (Personal Loan Retrieval):** The system shall allow a borrower to retrieve a list of only their own loan requests and active loans.
- **FR-07 (Custodian Loan Overview):** The system shall allow a custodian to view all loan requests and active loans across all borrowers.
- **FR-08 (Equipment Return & Condition Grading - Sprint 2):** The system shall permit a custodian to check in an active equipment loan (`POST /api/loans/:id/return`), record the physical condition assessment (`GOOD`, `FAIR`, or `DAMAGED`), add return notes, and automatically update item availability status.
- **FR-09 (Due Dates & Overdue Penalty Engine - Sprint 2):** The system shall assign a return due timestamp (`dueAt`, default 7 calendar days) upon checkout approval, detect overdue loans past `dueAt`, and compute accrued daily overdue penalty fines.
- **FR-10 (Multi-Item Batch Borrowing - Sprint 3):** The system shall allow an authenticated borrower to submit a single transactional batch request (`POST /api/loans/batch`) for up to 2 items simultaneously, ensuring atomic insertion and strict quota enforcement.
- **FR-11 (Inventory Search & Filter - Sprint 3):** The system shall allow users to search equipment by title, serial number, or category, and filter items by real-time status.

---

### 5. Business Rules (BR)
- **BR-01 (Single-Item Exclusivity):** An item can only have at most one active loan or pending request at any given time. If `item.isAvailable == false`, any request or checkout attempt on that item must be rejected.
- **BR-02 (No Duplicate Active Loans):** The system shall reject duplicate requests or checkouts for the same physical item while a loan is in `REQUESTED` or `ACTIVE` status.
- **BR-03 (Role Segregation for Checkout):** Only users with the `CUSTODIAN` role are authorized to execute the checkout operation (`POST /api/loans/:id/checkout`). Borrowers attempting this operation must receive an HTTP `403 Forbidden`.
- **BR-04 (Per-Borrower Concurrent Loan Quota - Adaptive Maintenance):** An authenticated `BORROWER` may hold at most **2 concurrent loans** in `REQUESTED` or `ACTIVE` status combined. If a borrower currently holds 2 loans across these statuses, any subsequent borrow request shall be rejected with `HTTP 409 Conflict`, error payload `{"error": "LOAN_LIMIT_EXCEEDED", "message": "Borrower has reached the maximum limit of 2 concurrent loans (pending or active)."}`, and zero database rows shall be inserted. Loans with status `RETURNED` or `CANCELLED` do not count toward this limit.
- **BR-05 (Ownership Data Isolation):** A borrower cannot inspect or modify another borrower's loan details. Unrelated borrower requests to private loan records must be rejected with HTTP `403 Forbidden`.
- **BR-06 (Custodian Return Exclusivity - Sprint 2):** Only users with the `CUSTODIAN` role are authorized to execute the return and check-in operation (`POST /api/loans/:id/return`). Borrowers attempting return receive HTTP `403 Forbidden`. Non-active loans cannot be returned (HTTP `409 Conflict`).
- **BR-07 (Damaged Condition Quarantine - Sprint 2):** When an item is returned with `conditionGrade == 'DAMAGED'`, the item state shall transition to `isAvailable = false` and status `MAINTENANCE`. Only items returned in `GOOD` or `FAIR` condition shall return to `isAvailable = true` (`AVAILABLE`).
- **BR-08 (Overdue Penalty Formula - Sprint 2):** For active loans exceeding `dueAt`, the overdue penalty fine is calculated as: `fine = max(0, ceil((now - dueAt) / (1000 * 60 * 60 * 24))) * 5.00` ($5.00 per elapsed calendar day).
- **BR-09 (Atomic Batch Validation - Sprint 3):** In a batch borrow request (`POST /api/loans/batch`), all items must be available and the total items in the batch plus the borrower's currently held active/pending loans must not exceed 2. If any item is unavailable or the limit is exceeded, the entire transaction rolls back with zero rows persisted (HTTP `409 Conflict`).

---

### 6. Acceptance Criteria (AC)
- **AC-01:** Valid email and password authentication yields a signed JWT with 24-hour expiry and HTTP 200 OK.
- **AC-02:** Invalid credentials return HTTP 401 Unauthorized without leaking sensitive user details.
- **AC-03:** Logout invalidates client-side session token.
- **AC-04:** Protected endpoints reject missing or malformed tokens with HTTP 401 Unauthorized.
- **AC-05:** Borrower attempting Custodian checkout receives HTTP 403 Forbidden.
- **AC-06:** Passwords in database are hashed with bcrypt (salt rounds >= 10).
- **AC-07:** Item catalog lists all items with real-time availability and tri-state status (`AVAILABLE`, `PENDING_APPROVAL`, `CHECKED_OUT`).
- **AC-08:** Borrower loan request creates loan record in `REQUESTED` status with HTTP 201 Created.
- **AC-09:** Requesting an unavailable item returns HTTP 409 Conflict with item unavailable message.
- **AC-10:** Duplicate loan request for already requested item returns HTTP 409 Conflict.
- **AC-11:** Borrower inspecting loans receives only loans associated with their own `borrowerId`.
- **AC-12:** Custodian checkout transitions loan from `REQUESTED` to `ACTIVE` and sets `item.isAvailable = false`.
- **AC-13 (Quota Baseline Allowed Request):** An authenticated borrower holding 0 or 1 active/pending loans submitting a request for an available item shall succeed with HTTP 201 Created and loan status `REQUESTED`.
- **AC-14 (Quota Limit Rejection):** An authenticated borrower holding 2 active/pending loans submitting a 3rd borrow request shall be rejected with HTTP 409 Conflict and error code `LOAN_LIMIT_EXCEEDED`, and zero database rows shall be inserted.
- **AC-15 (Return - Good/Fair Condition):** Custodian checking in an active loan with condition `GOOD` or `FAIR` transitions loan to `RETURNED`, records `returnedAt`, and restores `item.isAvailable = true` (`AVAILABLE`), freeing the borrower's loan quota.
- **AC-16 (Return - Damaged Condition Quarantine):** Custodian checking in an active loan with condition `DAMAGED` transitions loan to `RETURNED`, but places the item into maintenance (`item.isAvailable = false`, status `MAINTENANCE`).
- **AC-17 (Return - Authorization & State Guard):** Borrower calling `POST /api/loans/:id/return` receives HTTP 403 Forbidden. Attempting return on a non-ACTIVE loan receives HTTP 409 Conflict.
- **AC-18 (Due Date Assignment on Checkout):** Upon Custodian checkout approval, system sets `loan.dueAt` to 7 days from the checkout timestamp.
- **AC-19 (Overdue Calculation):** If current date exceeds `loan.dueAt`, loan displays `OVERDUE` indicator and computes daily accrued fine ($5.00/day).
- **AC-20 (Batch Borrow Atomic Success):** Borrower with 0 active loans submitting batch of 2 available items receives HTTP 201 Created with 2 loan records created in `REQUESTED` status.
- **AC-21 (Batch Borrow Quota Violation):** Borrower submitting batch where (batch size + current active loans) > 2 receives HTTP 409 Conflict `LOAN_LIMIT_EXCEEDED`, and zero rows are inserted.
- **AC-22 (Batch Borrow Partial Availability Rollback):** If 1 of the items in a batch request is already checked out, the entire batch request fails with HTTP 409 Conflict, and zero items are requested.

---

### 6. Non-Functional Requirements (NFR)
- **NFR-01 (Credential Security):** Passwords must never be stored in plaintext. Passwords must be hashed using a standard cryptographic function (`bcrypt` with at least 10 salt rounds) before database persistence. Verified by backend unit/integration tests in Sprint 1.
- **NFR-02 (Access Control Enforcement):** Unauthenticated requests to protected endpoints must be rejected with HTTP `401 Unauthorized` without leaking internal data. Verified by automated API tests in Sprint 1.
- **NFR-03 (Response Latency):** Core API operations (login, catalog fetch, loan request, checkout) shall complete within 300ms under local testing conditions.

---

### 7. Significant Assumptions & Design Decisions
1. **Monolithic Architecture:** A single Node.js/Express backend serving a REST API to a React Single Page Application (SPA), using Prisma ORM with SQLite for local development and seamless migration to PostgreSQL for GCP containerization in Lab 5.
2. **Item Tracking Model:** Equipment is tracked as individual unique assets (with distinct serial/asset numbers) rather than pooled stock quantities.
3. **Session Management:** Stateless JSON Web Tokens (JWT) passed via the `Authorization: Bearer <token>` header, verified on every protected request by Express middleware.
