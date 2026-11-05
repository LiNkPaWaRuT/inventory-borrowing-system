# Three-Sprint Development Plan

## 1. Plan Overview
This roadmap establishes the scope, feature allocations, dependencies, and delivery outcomes across three development sprints to deliver the full **Inventory and Borrowing System**.

```mermaid
flowchart LR
    subgraph Sprint 1 ["Sprint 1 (Baseline & Core Slice)"]
        direction TB
        S1_1["F01: Auth & Roles"]
        S1_2["F02: Item Catalog & Loan Checkout"]
        S1_3["DB Baseline & Local Integration"]
    end

    subgraph Sprint 2 ["Sprint 2 (Core Expansion)"]
        direction TB
        S2_1["F03: Return & Check-in"]
        S2_2["F04: Due Dates & Overdue Calculation"]
        S2_3["F05: Catalog Search & Filters"]
    end

    subgraph Sprint 3 ["Sprint 3 (Completion & Hardening)"]
        direction TB
        S3_1["F06: Inventory Audit & Reports"]
        S3_2["F07: Batch Requests"]
        S3_3["Regression & Defect Hardening"]
    end

    Sprint 1 --> Sprint 2 --> Sprint 3
```

---

## 2. Sprint 1: Small Deployable Product (Deliverable 1 Checkpoint)
- **Goal:** Deliver a working vertical slice including authentication/authorization, item availability state, and a full request-to-checkout domain transaction.
- **Included Features:**
  - `F-01`: Authentication, JWT session lifecycle, password hashing, and role verification (`BORROWER`, `CUSTODIAN`).
  - `F-02`: Item catalog listing, borrower item request, custodian checkout action, and single-item exclusivity enforcement (BR-01, BR-02, BR-03, BR-04).
- **Dependencies:** Initial project scaffolding, Prisma models, database migrations, and seeded test accounts.
- **Completion Outcome:** Runnable full-stack application on `main` with passing automated tests and tagged release `v0.1.0-sprint1`.

---

## 3. Sprint 2: Core Expansion (Deliverable 2 Checkpoint)
- **Goal:** Expand system workflows to handle post-checkout lifecycle operations, temporal loan rules, and enhanced search.
- **Included Features:**
  - `F-03`: Return and check-in workflow. Custodians record returned items, restoring item availability to `true`.
  - `F-04`: Due-date tracking and overdue status computation. Automatic flag calculation based on current date vs. agreed return date.
  - `F-05`: Inventory search and filtering by category, availability, and serial number.
- **Dependencies:** Sprint 1 active loan models and database relations.
- **Completion Outcome:** Deployed integrated release candidate on GCP via CI/CD pipeline (Lab 5 & Deliverable 2).

---

## 4. Sprint 3: Completion and Hardening (Final Delivery)
- **Goal:** Complete advanced product features, administrative reporting, failure handling, and cross-team defect resolution.
- **Included Features:**
  - `F-06`: Inventory reporting, asset usage history summaries, and exportable loan records.
  - `F-07`: Multi-item batch borrowing with atomic transaction commits.
  - Defect triage and fixes resulting from Lab 6 Cross-team UAT.
- **Dependencies:** Full operational data flow from Sprints 1 & 2.
- **Completion Outcome:** Fully verified product release, demonstration video, and final project report.
