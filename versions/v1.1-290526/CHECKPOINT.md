# Checkpoint v1.1-290526
## CH_Eleven — Public Access Confirmed ✅
**Date:** 29 May 2026
**Status:** Live with Cloudflare Tunnel · all checklist items resolved

---

## What changed from v1.0

| Fix | Detail |
|---|---|
| nginx proxy config | Added `nginx.conf` — `/api/` now properly forwarded to backend for external users |
| UNIQUE constraint | `contest_teams.owner_name` — no duplicate registrations possible |
| DB migration fix | `DO $$ IF NOT EXISTS $$` pattern — always shows `6/6` cleanly |
| Podium heights | Bronze 60→95px · Silver 75→110px · Gold 100→130px — names now visible |
| VC on podium | Added Vice-Captain line to all 3 podium cards |
| Cloudflare Tunnel | ngrok replaced — zero SSL errors, no warning pages |
| Repo cleanup | Removed bulk-upload-endpoint.js, migration-temp.js, admin-upload-section.txt, package-lock.json |
| .gitignore hardened | Added *.exe, docs/screenshots/, CH_Eleven_Guide.pdf, scratch files |
| README rewritten | Professional layout with architecture diagram, scoring rules, workflow |

## Restore command

```bash
VERSION=v1.1-290526
cp versions/$VERSION/backend/server.js          backend/server.js
cp versions/$VERSION/backend/schema.sql         backend/schema.sql
cp versions/$VERSION/frontend/public/index.html frontend/public/index.html
cp versions/$VERSION/frontend/nginx.conf        frontend/nginx.conf
cp versions/$VERSION/docker-compose.yml         docker-compose.yml
docker compose build --no-cache backend frontend && docker compose up -d
```
