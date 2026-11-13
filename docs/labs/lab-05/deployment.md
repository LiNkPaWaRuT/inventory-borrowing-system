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
