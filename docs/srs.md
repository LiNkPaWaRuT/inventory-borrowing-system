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
- **FR-04 (Loan Request):** The system shall allow a borrower to submit a loan request for an available inventory item, creating a loan record with status `REQUESTED`.
- **FR-05 (Custodian Checkout):** The system shall allow a custodian to approve a pending loan request, marking the loan as `ACTIVE` and updating the item's availability to false.
- **FR-06 (Personal Loan Retrieval):** The system shall allow a borrower to retrieve a list of only their own loan requests and active loans.
- **FR-07 (Custodian Loan Overview):** The system shall allow a custodian to view all loan requests and active loans across all borrowers.

---

### 5. Business Rules (BR)
- **BR-01 (Single-Item Exclusivity):** An item can only have at most one active loan or pending request at any given time. If `item.isAvailable == false`, any request or checkout attempt on that item must be rejected.
- **BR-02 (No Duplicate Active Loans):** The system shall reject duplicate requests or checkouts for the same physical item while a loan is in `REQUESTED` or `ACTIVE` status.
- **BR-03 (Role Segregation for Checkout):** Only users with the `CUSTODIAN` role are authorized to execute the checkout operation (`POST /api/loans/:id/checkout`). Borrowers attempting this operation must receive an HTTP `403 Forbidden`.
- **BR-04 (Ownership Data Isolation):** A borrower cannot inspect or modify another borrower's loan details. Unrelated borrower requests to private loan records must be rejected with HTTP `403 Forbidden`.

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
