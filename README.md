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

## Run with Docker Compose (dev)

Starts MySQL 8.4, Mailpit, the Next.js app (standalone image), and Caddy (`:80` → `app:3000`). MinIO is not part of this stack yet.

```bash
cp .env.example .env
docker compose up --build
```

- App via Caddy: [http://localhost](http://localhost) (`:80` → Next `:3000`)
- App direct: [http://localhost:3000](http://localhost:3000)
- Mailpit UI: [http://localhost:8025](http://localhost:8025) (SMTP `localhost:1025`)
- MySQL: `localhost:3306` (user/password/database: `eduvoq`)
- Liveness: [http://localhost/api/health](http://localhost/api/health)
- Readiness: [http://localhost/api/ready](http://localhost/api/ready)

Compose substitutes `AUTH_URL` from `.env` (default `http://localhost:3000` for direct Next). For Caddy on `:80`, set `AUTH_URL=http://localhost` in `.env`.

After MySQL is up: `pnpm db:migrate && pnpm db:seed`. Dev admin is `admin@eduvoq.com` / `ChangeMe!admin` (dev-only; change before any shared environment). Verification and reset emails go to Mailpit when `SMTP_HOST` is set; otherwise the link is logged.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm build` | Production build (`output: "standalone"`) |
| `pnpm start` | Run the production server |
| `pnpm lint` | ESLint (`next/core-web-vitals`) |
| `pnpm test` | Vitest (age-gate unit tests) |
| `pnpm db:seed` | Seed admin, catalog, consultation services, sample blog posts |

Do not commit secrets or the `chalknpencil-archive/` snapshot.
