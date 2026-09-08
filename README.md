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

MySQL is not required for `pnpm dev` or `pnpm build` in this foundation stage.

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

`AUTH_URL` defaults to `http://localhost:3000` (direct Next). When using Caddy on `:80`, set `AUTH_URL=http://localhost`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm build` | Production build (`output: "standalone"`) |
| `pnpm start` | Run the production server |
| `pnpm lint` | ESLint (`next/core-web-vitals`) |

Do not commit secrets or the `chalknpencil-archive/` snapshot.
