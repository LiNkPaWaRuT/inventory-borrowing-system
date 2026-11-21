# Document Structure: Independent UAT Review Pack (QuickOrder)

## 1. Document Header & Identification
- **Milestone:** CPE334 Lab 6 — Independent User Acceptance Testing (UAT) Report
- **Application Reviewed:** QuickOrder (Campus Food & Merch Pre-Order Kiosk)
- **Product Team (Reviewed):** Section 31, Team PDF — Panyakorn Lohaviboonsap (67070503424) & Ivan Luwongsupakit (67070503449)
- **UAT Testing Team (Testers):** Section 31, Team Egoist
  - Pawarut Kumnungwut (67070503422)
  - Kawinpob Amnuaywittayakul (67070503403)
- **Live Deployment Tested:** https://quickorder-wcdixtgbxq-as.a.run.app
- **Tested Release & Baseline SHA:** Release B (Commit `aa632f65b254c5b1b4346a008943a1f192ce8b6b` / short `aa632f6`)
- **Testing Date:** 20 November 2026

---

## 2. Summary Execution Table

| Case ID | Category | Tester Name | Date / Time | Version Tested | Inputs Used | Expected Result | Actual Result Observed | Outcome | Evidence ID |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **UAT-QO-01** | Normal Journey | Pawarut Kumnungwut (67070503422) | 20 Nov 2026, 16:10 | Release B (`aa632f6`) | 2x Matcha ($4.50), 1x Croissant ($3.25) | Order placed; total $12.25; status SUBMITTED | Cart calculated $12.25; alert displayed; order appears in history as SUBMITTED | **PASS** | EVID-B-01 |
| **UAT-QO-02** | Boundary / Limit | Kawinpob Amnuaywittayakul (67070503403) | 20 Nov 2026, 16:13 | Release B (`aa632f6`) | Item: KMUTT Hoodie, Qty: 999 | Strict rejection; stock remains 15 | Red banner: "Insufficient stock for KMUTT Hoodie. Available: 15, Requested: 999"; stock unchanged | **PASS** | EVID-B-02 |
| **UAT-QO-03** | Forbidden Role | Pawarut Kumnungwut (67070503422) | 20 Nov 2026, 16:16 | Release B (`aa632f6`) | curl GET /orders & curl POST /orders/1/accept | HTTP 401 Unauthorized; data not exposed | HTTP/2 401 returned with UNAUTHORIZED message on both requests | **PASS** | EVID-B-03 |
| **UAT-QO-04** | State / Persistence | Kawinpob Amnuaywittayakul (67070503403) | 20 Nov 2026, 16:25 | Release B (`aa632f6`) | Sign out, hard reload (Cmd+Shift+R), sign back in | Order records persist durably | Order ID, items, and SUBMITTED status intact across session reload | **PASS** | EVID-B-04 |
| **UAT-QO-05** | State Advancement | Pawarut Kumnungwut (67070503422) | 20 Nov 2026, 16:30 | Release B (`aa632f6`) | Operator clicks "Accept Order" | Status transitions to ACCEPTED | Status updated to ACCEPTED in Operator Queue and Customer History | **PASS** | EVID-B-05 |

---

## 3. Evidence & Screenshots Section

### Evidence 0: Environment & Baseline Verification
- **Screenshot 0A:** Cloud deployment URL (`https://quickorder-wcdixtgbxq-as.a.run.app`) and visual version marker badge `v1.1-cloud` rendered in top navigation bar.
- **Screenshot 0B:** GitHub commits list on `main` branch verifying baseline Release B commit `aa632f6`.
- *Captions:*
  - `Figure B-0A. Cloud deployment URL and version marker verification on live Google Cloud Run.`
  - `Figure B-0B. Verified tested baseline Release B commit aa632f6 on main branch.`

### Evidence 1: Case UAT-QO-01 (Normal Domain Journey)
- **Screenshot 1A:** Multi-item cart calculation verifying 2x Matcha ($9.00) + 1x Croissant ($3.25) = Total $12.25.
- **Screenshot 1B:** Order placed successfully and persisted with status `SUBMITTED` in "My Order History".
- *Caption:* `Figure B-01. Case UAT-QO-01: Multi-item cart calculation and successful order creation with SUBMITTED status.`

### Evidence 2: Case UAT-QO-02 (Boundary & Stock Depletion Protection)
- **Screenshot 2:** System strictly rejects checkout when requested quantity (999) exceeds available stock (15); red banner shown; inventory stock remains intact.
- *Caption:* `Figure B-02. Case UAT-QO-02: Boundary stock protection rejecting over-request with explicit validation message.`

### Evidence 3: Case UAT-QO-03 (Forbidden Role & Unauthorized Access)
- **Screenshot 3:** Terminal showing unauthorized `curl` requests to `/api/operator/orders` returning `HTTP/2 401 Unauthorized` (`{"code":"UNAUTHORIZED"}`).
- *Caption:* `Figure B-03. Case UAT-QO-03: Direct unauthorized API requests to operator endpoints returned HTTP/2 401 Unauthorized.`

### Evidence 4: Case UAT-QO-04 (Order History State Persistence Across Reload)
- **Screenshot 4:** Customer order record persisted durably in Google Cloud SQL PostgreSQL across session sign-out and browser hard reload.
- *Caption:* `Figure B-04. Case UAT-QO-04: Customer order record persisted durably in Cloud SQL across session sign-out and browser hard reload.`

### Evidence 5: Case UAT-QO-05 (Operator Order Queue Intake & State Advancement)
- **Screenshot 5A:** Operator accepts pending order in "Operator Order Queue"; queue updates status to `ACCEPTED`.
- **Screenshot 5B:** Customer order history reflects real-time status advancement to `ACCEPTED`.
- *Caption:* `Figure B-05. Case UAT-QO-05: Real-time order state transition from SUBMITTED to ACCEPTED across Operator and Customer sessions.`

---

## 4. Defect Disposition & Triage Statement

### Defect Findings & Classification:
During our independent UAT execution of **QuickOrder** (Release B, commit `aa632f65b254c5b1b4346a008943a1f192ce8b6b`), all 5 test cases executed completely without any unexpected failures, security bypasses, data inconsistencies, or crashes.

- **Total Findings Received:** 0
- **Critical / Major Defects:** 0
- **Minor Limitations:** 0
- **Outgoing Defect Tickets Filed:** None (All test cases PASSED against agreed Sprint 1 Scope).

---

## 5. Official Signed UAT Acceptance Decision

```text
========================================================================================
OFFICIAL SPRINT 1 UAT ACCEPTANCE SIGN-OFF
========================================================================================
Product Name: QuickOrder (Campus Food & Merch Pre-Order Kiosk)
Product Team: Section 31, Team PDF (Panyakorn Lohaviboonsap & Ivan Luwongsupakit)
Tested Release Commit: aa632f65b254c5b1b4346a008943a1f192ce8b6b (Release B v1.1-cloud)
Live Cloud URL: https://quickorder-wcdixtgbxq-as.a.run.app

UAT Testing Team: Section 31, Team Egoist
Lead UAT Testers: Pawarut Kumnungwut (67070503422) & Kawinpob Amnuaywittayakul (67070503403)
Date: 20 November 2026

Final UAT Decision (Select One):
[X] ACCEPTED: All critical and major UAT cases pass cleanly without blocking defects.
[ ] ACCEPTED WITH MINOR LIMITATIONS: Core journeys pass; minor non-blocking issues noted.
[ ] NOT ACCEPTED: Critical defects remain unresolved or required test journeys fail.

UAT Sign-off Notes:
Independent testing of QuickOrder Sprint 1 Release B completed across all 5 test categories. 
Catalog browsing, multi-item cart pricing ($12.25), inventory boundary enforcement 
(rejection of quantity 999), API authorization (HTTP 401 on unauthorized access), database 
persistence across reload, and operator status machine transitions were verified on the live 
GCP Cloud Run environment. All acceptance criteria are met. Sprint 1 acceptance is officially granted.
========================================================================================
```

