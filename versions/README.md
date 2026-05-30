# CH_Eleven — Version Checkpoints

Each folder here is a full snapshot of all production files at a stable point.
If anything breaks, copy the folder's files back and rebuild Docker.

## How to read the folder names

```
v{major}.{minor}-{DDMMYY}
```

Example: `v1.0-270527` = version 1.0, snapshotted on 27 May 2026.

## Checkpoints

| Version | Date | Status | Summary |
|---|---|---|---|
| [v1.0-270527](./v1.0-270527/CHECKPOINT.md) | 27 May 2026 | ✅ Stable | First full match uploaded + backtested. All 28 players correct. |
| [v1.1-290526](./v1.1-290526/CHECKPOINT.md) | 29 May 2026 | ✅ Current | nginx proxy · UNIQUE constraint · podium fix · Cloudflare tunnel · repo cleanup |

## Restore command (replace VERSION with folder name)

```bash
VERSION=v1.0-270527

cp versions/$VERSION/backend/server.js          backend/server.js
cp versions/$VERSION/backend/schema.sql         backend/schema.sql
cp versions/$VERSION/frontend/public/index.html frontend/public/index.html
cp versions/$VERSION/docker-compose.yml         docker-compose.yml

docker compose build --no-cache backend frontend
docker compose up -d
docker logs ch-eleven-backend-1 --tail 5
```

## Adding a new checkpoint

```bash
NEW=v1.1-DDMMYY
cp -r versions/v1.0-270527 versions/$NEW
# Edit versions/$NEW/CHECKPOINT.md to document what changed
# Then overwrite files with current production versions:
cp backend/server.js          versions/$NEW/backend/
cp backend/schema.sql         versions/$NEW/backend/
cp frontend/public/index.html versions/$NEW/frontend/public/
cp docker-compose.yml         versions/$NEW/
```
