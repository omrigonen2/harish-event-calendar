# City Events Calendar Platform

A multi-tenant, AI-powered events calendar SaaS. Built as a single Node.js/Express process that renders EJS views for both the admin and public interfaces, stores data in MongoDB, and keeps all third-party integrations (S3-compatible storage, OpenAI, Resend email) in encrypted **Platform Settings**.

## Stack

- Node.js + Express (monolith, server-rendered EJS)
- MongoDB via Mongoose
- S3-compatible storage (iDrive e2) through the AWS SDK v3
- OpenAI for AI translation and marketing copy
- Resend for transactional email

## Architecture

- Platform super admin manages tenants and the platform-wide integrations.
- Each tenant is fully isolated by `tenantId` and configures its own branding, languages, categories, audiences, users, AI prompt, and preferred model.
- Roles: `super_admin` (platform), `manager` and `editor` (per tenant).

```
src/
  app.js / server.js      Express bootstrap + entry point
  config/                 env + constants
  lib/                    crypto, db, s3, openai, resend, sanitize, ics, helpers
  models/                 Mongoose schemas
  middleware/             session, auth, tenant resolution, roles, csrf, rate limits
  services/               business logic
  routes/web/             EJS page routes (auth, platform, admin, public)
  routes/api/v1/          REST API (Bearer-token auth)
  views/                  EJS templates + layouts
public/                   CSS + client JS
scripts/                  seed + index migration
```

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` from the example and fill in the core secrets:

```bash
cp .env.example .env
```

Required variables:

- `MONGODB_URI` — MongoDB connection string
- `SESSION_SECRET` — long random string
- `ENCRYPTION_KEY` — 32 bytes as 64 hex chars (used to encrypt integration secrets)

Generate an encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Sync indexes and seed a super admin + demo tenant:

```bash
npm run migrate
npm run seed
```

4. Start the server:

```bash
npm run dev
```

Visit `http://localhost:3000` and sign in with the seeded super admin (`SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`).

## Configure integrations

Sign in as the super admin and open **Platform Integrations** (`/platform/settings`):

- **Storage (S3 / iDrive e2):** endpoint, region, bucket, access key, secret. Use the "Test upload" button.
- **OpenAI:** API key. Use "Test (list models)".
- **Email (Resend):** API key, from email, from name. Use "Send test email". Verify your sender domain in Resend before production.

Secrets are encrypted at rest with `ENCRYPTION_KEY` and never returned to the browser.

## Demo accounts (after `npm run seed`)

- Super admin: the values from `SEED_SUPERADMIN_EMAIL` / `SEED_SUPERADMIN_PASSWORD`
- Tenant manager: `manager@harish.example` / `ChangeMe123!` on tenant `harish`

Public calendar for the demo tenant: `http://localhost:3000/c/harish`

## REST API

Create a token in tenant **Settings → API tokens**, then:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/events
```

## Deployment (Render)

`render.yaml` defines a web service. Set `MONGODB_URI`, `ENCRYPTION_KEY`, and `APP_BASE_URL` in the dashboard (`SESSION_SECRET` is generated). The pre-deploy step runs the index migration. Uploads go to S3 because the Render filesystem is ephemeral.
