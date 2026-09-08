# DNS cutover — www.eduvoq.com

Canonical URL: `https://www.eduvoq.com`. Production host is DigitalOcean droplet **neojn** (`blr1`, IPv4 `68.183.85.203`). Apex `eduvoq.com` 301s to www.

PR 17 did not ship a runbook; this is the cutover note.

## Records

Lower TTL (300s) on `@` and `www` at least 24 hours before the window.

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `68.183.85.203` |
| `www` | A | `68.183.85.203` |

Do not point DNS at Wix, Cloudflare proxy, or a second VPS. Cookie domain is `.eduvoq.com` with `AUTH_URL=https://www.eduvoq.com`.

Host Caddy (already on neojn) should serve:

```caddy
www.eduvoq.com {
  encode gzip zstd
  reverse_proxy 127.0.0.1:3110
}

eduvoq.com {
  redir https://www.eduvoq.com{uri}
}
```

Path-level Wix aliases live in `redirects.json` (Next 301s). Caddy only needs host-level apex → www.

## Phased cutover from Wix

1. App is up on neojn (`127.0.0.1:3110` + `eduvoq.caddy` + systemd + `eduvoq_db`). Staff QA via hosts file if needed.
2. Freeze Wix blog; final post extract if anything published since the archive.
3. Point `@` + `www` A → `68.183.85.203`.
4. If `eduvoq.wixsite.com/chalknpencil` is kept, configure Wix to 301 to `https://www.eduvoq.com` (the `/chalknpencil` prefix is also 301’d in-app).
5. Keep Wix unpublished after 14 days if no rollback.

Rollback: restore DNS to Wix. The app can stay read-only. New member data (signups, orders, bookings) is not on Wix — communicate a maintenance window.

## Checks after TTL

- `https://eduvoq.com/` → 301 `https://www.eduvoq.com/`
- `https://www.eduvoq.com/api/health` → 200
- Sample aliases: `/about-us` → `/about`, `/plans-pricing` → `/pricing`, `/my-wallet` → `/account/wallet`
- Login/register set the Auth.js cookie on `.eduvoq.com`
