# EduVoq

Connecting Educators.

This repository is a greenfield rebuild of the EduVoq public site as a self-hosted Next.js application. This README covers **local development only**.

## Prerequisites

- Node.js 20.9+ (LTS recommended)
- [pnpm](https://pnpm.io)
- Docker Desktop (optional, for Compose)

## Run locally with pnpm

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Auth pages (`/login`, `/register`, `/forgot-password`, `/verify-email`, `/complete-profile`) need MySQL for real sign-in. `pnpm build` still works with dummy `DATABASE_URL` / `AUTH_SECRET`.

Host `pnpm dev` uses `FILE_DRIVER=local` and writes to `./storage` (gitignored). Production uses the same driver on `/var/www/eduvoq/storage`.

## Run with Docker Compose (dev)

Starts MySQL 8.4, Mailpit, MinIO, the Next.js app (standalone image), and Caddy (`:80` → `app:3000`). MinIO is **dev only** — do not run it on the production droplet.

```bash
cp .env.example .env
docker compose up --build
```

- App via Caddy: [http://localhost](http://localhost) (`:80` → Next `:3000`)
- App direct: [http://localhost:3000](http://localhost:3000)
- Mailpit UI: [http://localhost:8025](http://localhost:8025) (SMTP `localhost:1025`)
- MySQL: `localhost:3306` (user/password/database: `eduvoq`)
- MinIO API: [http://127.0.0.1:9000](http://127.0.0.1:9000) (loopback only; console `:9001`, user `minio` / `miniopass`)
- Liveness: [http://localhost/api/health](http://localhost/api/health)
- Readiness: [http://localhost/api/ready](http://localhost/api/ready)

Compose sets `FILE_DRIVER=s3` against MinIO. The app creates the `eduvoq` bucket on first upload. Downloads always stream through `GET /api/files/[id]` (no presigned MinIO redirect).

Compose substitutes `AUTH_URL` from `.env` (default `http://localhost:3000` for direct Next). For Caddy on `:80`, set `AUTH_URL=http://localhost` in `.env`.

After MySQL is up: `pnpm db:migrate && pnpm db:seed`. Dev admin is `admin@eduvoq.com` / `ChangeMe!admin` (dev-only; change before any shared environment). Verification and reset emails go to Mailpit when `SMTP_HOST` is set; otherwise the link is logged.

## Resource Corner

| Route | Auth | Notes |
| --- | --- | --- |
| `/resources` | member | Hub |
| `/resources/learning-material` | member | Uploads + `EDUCATOR_ONLY` downloads |
| `/resources/class-notes` | member | Uploads + `EDUCATOR_ONLY` downloads |
| `/resources/sample-papers` | member | Sample papers + lesson plans |
| `/sample-papers` | public teaser | Metadata only; `GET /api/files/[id]` enforces login + entitlement |

Educator/expert uploads land in `Resource.status=IN_REVIEW`. Staff/admin uploads publish immediately. MIME allowlist: PDF, JPEG, PNG, WebP. Cap: 25 MB (images 5 MB). No virus scanner.

## Store

| Route | Auth | Notes |
| --- | --- | --- |
| `/store` | public | Two stationery SKUs only |
| `/store/products/[slug]` | public | Add to cart is member-only |
| `/cart` `/checkout` | member | DB cart; no guest checkout |
| `/account/orders` `/account/addresses` | member | India addresses; GST ₹0 |

Physical self-ship (`commerce_physical=true`): India only, prepaid, no COD. Metro ₹79 / rest of India ₹129. `placeOrder` decrements stock in a transaction and leaves the order `PENDING_PAYMENT` until payments (PR 15). Placeholder `i-m-a-product-*` SKUs are not sold.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm build` | Production build (`output: "standalone"`) |
| `pnpm start` | Run the production server |
| `pnpm lint` | ESLint (`next/core-web-vitals`) |
| `pnpm test` | Vitest (age-gate, storage, entitlements, commerce) |
| `pnpm db:seed` | Seed admin, catalog, consultation services, shipping rates |

Do not commit secrets or the `chalknpencil-archive/` snapshot.
