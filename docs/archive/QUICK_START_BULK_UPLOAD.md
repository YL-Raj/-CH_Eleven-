# 🚀 Bulk Upload - Quick Start (3 Steps)

## Step 1: Copy Python Parser
```bash
cp match_data_parser.py ./ocr-service/
```

## Step 2: Update Files
Edit `/backend/server.js` - add this import at top:
```javascript
const multer = require("multer");
```

Then paste the entire `/api/match/bulk-upload` endpoint from `bulk-upload-endpoint.js`.

## Step 3: Update Admin UI
In `/frontend/public/index.html`, find the Admin panel section and replace the "Contest settings" card with the entire content from `admin-upload-section.html`.

---

## Test It

```bash
docker compose build --no-cache
docker compose up -d

# Go to: http://localhost:3000
# Click: Admin tab
# Drag: sample-match-complete.csv onto upload area
# Click: Upload & Process
# Success! ✓
```

---

## Files Reference

| File | What It Does |
|------|--------------|
| `match_data_parser.py` | Parses CSV/JSON match data |
| `admin-upload-section.html` | Drag-drop upload UI + match workflow |
| `bulk-upload-endpoint.js` | Backend bulk upload endpoint |
| `sample-match-complete.csv` | Test file with complete match |
| `BULK_UPLOAD_INTEGRATION.md` | Full integration guide |
| `IMPLEMENTATION_SUMMARY.md` | Detailed overview |

---

## What Happens After Upload

1. **Match Info Auto-Filled** - Match name, teams, date
2. **Players Auto-Created** - 22 players created from squad data
3. **Stats Updated** - All batting/bowling stats populated
4. **Leaderboard Refreshed** - Live points calculated
5. **Users See Results** - Teams show updated standings

---

That's it! You're done. 🎉
