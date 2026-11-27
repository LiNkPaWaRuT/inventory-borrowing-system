# Change & Defect Register (Deliverable 2 - Part A)

This register tracks all architectural baseline changes, maintenance findings, and defect resolutions identified across deployment, independent User Acceptance Testing (UAT), and adaptive maintenance through Labs 5–7.

## 1. Change & Defect Summary Table

| Change / Defect ID | Source | Affected Req / Feature | Summary of Finding / Change | Accepted Decision | Status | Fix / Change Release | Re-Test Outcome |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **DEF-01** | Lab 6 Cross-Team UAT (Team Be Bare Bares, Issue #33) | `FR-03`, `F-02` (Catalog) | Items in `REQUESTED` status awaiting Custodian checkout prematurely displayed the red `Checked Out` badge, confusing borrowers. | Introduce tri-state catalog status (`AVAILABLE`, `PENDING_APPROVAL`, `CHECKED_OUT`) and display an intermediate amber `● Pending Review` badge on the equipment catalog. | **Resolved** | PR #34 -> PR #35 (Commit `6a19bd1`) | Verified on Cloud Run (`EVID-D-01`). Independent UAT accepted by Team Be Bare Bares. |
| **CR-L7-01** | Lab 7 Adaptive Maintenance (Issue #36, PR #41) | `FR-04`, `BR-04` (Loan Quota) | Original Sprint 1 permitted unlimited concurrent equipment requests/loans per borrower, leading to inventory hoarding risks. | Enforce business rule `BR-04`: An authenticated `BORROWER` may hold at most 2 concurrent loans in `REQUESTED` or `ACTIVE` status combined. Reject 3rd attempt with HTTP 409 `LOAN_LIMIT_EXCEEDED`. | **Resolved** | PR #43 -> PR #44 (Commit `9ac5472`) | Automated TDD test `TEST-L7-01` (16/16 tests pass). Live smoke test verified on Cloud Run (`EVID-SMOKE-01`, `EVID-SMOKE-02`). |
| **SEC-01** | Lab 5 Cloud SQL Deployment | `NFR-01`, Database Config | Initial deployment seed used hardcoded credentials; needed Secret Manager integration for production environment. | Refactored `prisma/seed.ts` to source `ADMIN_PASSWORD` from Google Secret Manager (`OnLpaQC01mgtF1Aa1!`). | **Resolved** | Commit `f89023a` (Lab 5 Baseline) | Successful Cloud Run container startup and secure authentication confirmed. |

---

## 2. Baseline Version Reference

- **Accepted Sprint 1 Baseline Commit:** `f89023add2051fb64c5f241663037dd8d0ee91de` (`f89023a`)
- **Lab 6 Corrective Maintenance Commit (`DEF-01`):** `6a19bd1a66275c977f62e8ea5b106263725cf9a9` (`6a19bd1`)
- **Lab 7 Adaptive Maintenance Commit (`BR-04`):** `9ac54728d8b671a5323a17e089d81d22227d8db8` (`9ac5472`)
- **Starting Release Candidate Baseline for Deliverable 2:** `9ac5472`
