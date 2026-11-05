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
| **BR-04** | Ownership isolation (cross-borrower block)| `F-02` | Item Catalog & Request | Sprint 1 | `AC-11` | `TEST-LOAN-05` | Automated API (Supertest) |
| **NFR-01** | Passwords hashed using bcrypt | `F-01` | Auth & Access Control | Sprint 1 | `AC-06` | `TEST-AUTH-05` | Automated Unit Test (Prisma seed/hash) |
| **NFR-02** | Protected routes reject unauthenticated | `F-01` | Auth & Access Control | Sprint 1 | `AC-04` | `TEST-AUTH-03` | Automated API (Supertest) |
| **NFR-03** | API responses within 300ms | `F-01`, `F-02` | System Baseline | Sprint 1 | `AC-01`, `AC-08` | `TEST-PERF-01` | Automated Benchmark / Test suite timing |
| **FR-08** | Return item workflow & condition log | `F-03` | Return & Check-in | Sprint 2 | `AC-13`, `AC-14` | TBD (Sprint 2) | Automated API + UI |
| **FR-09** | Due dates and overdue calculations | `F-04` | Due Date Management | Sprint 2 | `AC-15`, `AC-16` | TBD (Sprint 2) | Automated Unit/API |
| **FR-10** | Item search and category filtering | `F-05` | Catalog Search & Filter | Sprint 2 | `AC-17` | TBD (Sprint 2) | React UI + API query |
| **FR-11** | Audit log & inventory reporting export | `F-06` | Inventory Reporting | Sprint 3 | `AC-18` | TBD (Sprint 3) | Automated System Test |
| **FR-12** | Multi-item request batching | `F-07` | Batch Requests | Sprint 3 | `AC-19` | TBD (Sprint 3) | Automated API + UI |
