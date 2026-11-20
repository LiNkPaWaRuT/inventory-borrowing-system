# Deployment and Environment Specification (Lab 5)

## 1. Stack Architecture & Differences from Reference
- **Frontend:** React SPA built with Vite, served statically by Express or nginx.
- **Backend API:** Node.js with Express exposing REST API at `/api`.
- **Database:** PostgreSQL on Google Cloud SQL (or SQLite locally for development), managed via Prisma ORM.
- **Hosting Platform:** Google Cloud Run (containerized, serverless, scale-to-zero).
- **Container Registry:** Google Artifact Registry (`asia-southeast1`).
- **Secrets Management:** Google Cloud Secret Manager (for `DATABASE_URL` and `JWT_SECRET`).

---

## 2. Environment Variables & Secrets Reference

| Variable Name | Purpose | Is Secret? | Source / Where it comes from |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | PostgreSQL connection string with credentials | **Yes** | Google Secret Manager (`inventory-database-url`) |
| `JWT_SECRET` | Secret key used to sign and verify user JWTs | **Yes** | Google Secret Manager (`inventory-jwt-secret`) |
| `PORT` | Listening port for the HTTP server | No | Injected automatically by Cloud Run (e.g. `8080`) |
| `NODE_ENV` | Application runtime mode (`production` / `development`) | No | Plain environment variable in Cloud Run container spec |
| `TZ` | Container timezone (`Asia/Bangkok`) | No | Plain environment variable in Cloud Run container spec |

---

## 3. Local and Production Commands

### Build & Run Locally
```bash
# Install dependencies
npm install

# Database setup & migrations
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# Run automated test suite
npm test

# Run development servers (Frontend + Backend concurrently)
npm run dev
```

### Production Cloud Build & Seed Commands
```bash
# Run Prisma migrations against Cloud SQL
npx prisma migrate deploy

# Run non-destructive production seed
npm run db:seed
```

---

## 4. GCP Resources & Infrastructure Configuration

| Resource Type | Resource Name | Region / Spec |
| :--- | :--- | :--- |
| **GCP Project** | `cpe334-egoist` | Global |
| **Artifact Registry** | `inventory-repo` | `asia-southeast1` (Docker format) |
| **Cloud SQL Instance** | `inventory-db` | `asia-southeast1`, PostgreSQL 16, `db-f1-micro`, storage auto-increase off |
| **Cloud Run Service** | `inventory-service` | `asia-southeast1`, min 0, max 3 instances, 512MB RAM |
| **Migration Job** | `inventory-migrate` | `asia-southeast1`, Cloud Run Job |
| **Service Accounts** | `inventory-runner`<br>`inventory-deployer` | Runtime Service Account<br>CI/CD Deployment Service Account |

---

## 5. Repeatable Release Procedure
1. Create a feature branch from `staging`.
2. Implement changes, run tests locally (`npm test`), and commit.
3. Open PR into `staging`. GitHub Actions runs automated CI tests (`test-and-docker`).
4. Teammate reviews and approves PR. Merge into `staging`.
5. Open release PR from `staging` into `main`. The `protect-main` ruleset requires 1 approval and passing CI checks.
6. Upon merging to `main`, GitHub Actions `deploy.yml` triggers via Workload Identity Federation:
   - Builds container image tagged with `${GITHUB_SHA}`.
   - Pushes image to Artifact Registry and resolves immutable SHA256 digest.
   - Executes `inventory-migrate` Cloud Run Job to apply any pending database schema updates.
   - Updates `inventory-service` to deploy the new container image digest.
   - Runs automated post-deployment smoke test (`deploy/smoke_test.py`) against `/api/health` and `/api/ready`.

---

## 6. Data Persistence & Architecture Verification (Check C-05)
- **Decoupled Persistence Architecture:**
  - Cloud Run container instances are entirely stateless and ephemeral. Containers can scale down to zero, terminate, or be replaced by new container image revisions at any time.
  - All stateful data (inventory items, users, loan requests, active checkouts) is persisted in Google Cloud SQL (PostgreSQL 16) instance `inventory-db`.
  - The application connects to Cloud SQL via a secure Unix Domain Socket located at `/cloudsql/cpe334-egoist:asia-southeast1:inventory-db`.
  - Cloud Run service account `inventory-runner` is granted `roles/cloudsql.client`, and connection credentials are injected securely from Secret Manager (`inventory-database-url`).
- **Persistence Verification Procedure:**
  1. **Record Creation (State A):** Create or update a persistent entity (such as requesting equipment or creating an item) on the live production URL. Note down the item serial, title, or borrower loan record.
  2. **Application Redeploy / Restart / Rollback:** Deploy an alternate container revision (via automated rollback or redeployment).
  3. **Verification (State A Intact):** Access the application on the new/rolled-back revision. Verify that all previously stored records and user states are intact and unchanged in Cloud SQL.

---

## 7. Safe Rollback and Roll-Forward Procedure
In the event that a faulty release is deployed to production, the continuous deployment pipeline supports deterministic, zero-downtime rollbacks to any previously verified release image without risking database corruption:

### Rollback Steps (GitHub Actions):
1. Navigate to **Actions** → **Deploy demo** in the repository.
2. Click **Run workflow** dropdown on the right:
   - Target branch: `main`
   - `image_tag`: Enter the full 40-character commit SHA of an existing image in Artifact Registry (e.g. an earlier verified release).
3. Click **Run workflow**.
4. **Safety Guarantees during Rollback:**
   - The CI test and Docker build stages are skipped.
   - The database migration job (`inventory-migrate`) is **intentionally skipped** so that the database schema is not modified or rolled back unsafely.
   - Cloud Run points traffic directly to the immutable digest of the specified image.
   - Post-deployment smoke tests execute to verify service health and database readiness.

### Roll-Forward Steps:
1. When the fix is prepared or when restoring to the latest version on `main`:
2. Navigate to **Actions** → **Deploy demo** → **Run workflow**.
3. Leave `image_tag` empty (or supply the target commit SHA) and click **Run workflow**.
4. The workflow will run the standard CI quality gate, build, apply pending migrations, and deploy the updated service revision.

---

## 8. Lab 5 Evidence & Quality Gate Verification Matrix

| Check | Requirement | Description | Status & Evidence |
| :--- | :--- | :--- | :--- |
| **C-01** | R-05 | CI workflow on PRs runs build & automated tests | PR #21 / PR #22 green `test-and-docker` check |
| **C-02** | R-06 | Temporary branch PR with failing test is blocked by `protect-main` ruleset | PR #28 blocked with failed status check |
| **C-03** | R-01, R-02 | Clean clone builds and runs container with environment config | Dockerfile multi-stage build, docker-compose |
| **C-04** | R-03 | Domain workflow on live Cloud Run URL (`*.run.app`) | Custodian login, dashboard, active loans verified |
| **C-05** | R-04 | Data persists across container restart, redeploy, and rollback | Cloud SQL PostgreSQL persistence across revisions |
| **C-06** | R-07, R-08 | Repeatable release pipeline from `staging` to `main` via WIF & CD | Deploy demo workflow run, Cloud Run revision digest |

