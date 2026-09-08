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

Starts MySQL 8.4 and the Next.js app (standalone image).

```bash
cp .env.example .env
docker compose up --build
```

- App: [http://localhost:3000](http://localhost:3000)
- MySQL: `localhost:3306` (user/password/database: `eduvoq`)

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Next.js development server |
| `pnpm build` | Production build (`output: "standalone"`) |
| `pnpm start` | Run the production server |
| `pnpm lint` | ESLint (`next/core-web-vitals`) |

Do not commit secrets or the `chalknpencil-archive/` snapshot.
