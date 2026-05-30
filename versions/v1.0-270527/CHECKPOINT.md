# Checkpoint v1.0-270527
## CH_Eleven — First Live Match Verified ✅
**Date:** 27 May 2026  
**Status:** All systems working, backtest passed, ready to upload

---

## What this checkpoint represents

This is the first fully verified, production-ready state of CH_Eleven.
- Squad upload works (5 CSV formats auto-detected)
- 1st innings upload works (live mode)
- 2nd innings upload works (accumulates on top of 1st)
- DB migration is robust (per-statement, never blocks)
- All 28 player points verified against real PDF scorecard
- Scoring engine backtested against exact server.js calcPoints() logic

---

## Files in this snapshot

| File | Lines | What it does |
|---|---|---|
| `backend/server.js` | 810 | Core API — squad parser, innings upload, scoring engine, fuzzy match |
| `backend/schema.sql` | 83 | DB schema — all tables including result/score/innings_loaded columns |
| `backend/package.json` | 21 | Backend dependencies (express, pg, multer, csv-parse) |
| `frontend/public/index.html` | 1304 | Full frontend — leaderboard, admin panel, upload cards, accordion math |
| `ocr-service/match_data_parser.py` | 264 | CSV/JSON innings parser |
| `ocr-service/ocr_service.py` | 367 | OCR Flask service |
| `docker-compose.yml` | 65 | All 4 services (db, backend, frontend, ocr) |
| `.env.example` | 8 | Safe env template (no real credentials) |
| `.gitignore` | 33 | Protects .env, test-cache/, node_modules |

---

## Key fixes included vs earlier versions

- ✅ Squad parser: 5 CSV formats (TEAM header / SQUAD header / role-col / TEAM-prefix / blank-sep)
- ✅ DB startup migration: per-statement try-catch — never blocks on "column already exists"
- ✅ Schema: `result`, `team_a_score`, `team_b_score`, `innings_loaded`, `status` columns all present
- ✅ Duck detection: excludes not out / dnb / absent / retired / did not field / did not play
- ✅ parseCricketOvers: 0.4 → 0.667 (4 balls), not 0.4 decimal
- ✅ Fuzzy name matcher: handles (C), (VC), team-hint disambiguation, case differences
- ✅ 2nd innings: accumulates stats with `runs + $1` — doesn't overwrite 1st innings

---

## Verified match data (27-May-2026)

**TEAM SHREYAS IYER 112/8 vs M.S Dhoni 107/10**  
Unity Pride League Kakinada | 7 overs | TEAM SHREYAS IYER won by 5 runs

### Upload sequence
```
templates/test-cache/squad-270527.csv       ← 28 players, 2 teams
templates/test-cache/1st-innings-270527.csv ← 10 batters, 6 bowlers (112/8)
templates/test-cache/2nd-innings-270527.csv ← 11 batters, 6 bowlers (107/10)
```

### Expected top scorers (calcPoints exact)
| Rank | Player | Team | PTS |
|---|---|---|---|
| 1 | Adrit | TEAM SHREYAS IYER | 136 |
| 2 | Devi Prasad Madoori | M.S Dhoni | 79 |
| 3 | Lazy Nani | M.S Dhoni | 71 |
| 4 | Rana Billa | TEAM SHREYAS IYER | 70 |
| 5 | Ghost Ryder | M.S Dhoni | 51 |
| 6 | Leo | TEAM SHREYAS IYER | 50 |
| 7 | Kichu | M.S Dhoni | 35 |
| 8 | Tom Captain | TEAM SHREYAS IYER | 38 |

---

## Scoring rules (server.js calcPoints — exact)

**Batting:** 1pt/run · 1pt/4 · 2pt/6 · +8@50R · +16@100R · −2 duck  
**SR bonus** (if balls≥10): ≥150→+4 · ≥130→+2 · ≥120→+1  
**SR penalty** (if balls≥10): <50→−6 · <60→−4 · <70→−2  
**Bowling:** 25pt/wkt · 3W→+4 · 4W→+8 · 5W→+16 · 8pt/maiden  
**Economy** (if overs≥2): <5→+6 · <6→+4 · ≤7→+2 · ≥10→−2 · ≥11→−4 · ≥12→−6  
**Fielding:** catch+8 · stumping+12 · direct RO+12 · indirect RO+6  

---

## How to restore from this checkpoint

If something breaks in a future version, restore by:

```bash
# Copy checkpoint files back over production
cp versions/v1.0-270527/backend/server.js         backend/server.js
cp versions/v1.0-270527/backend/schema.sql        backend/schema.sql
cp versions/v1.0-270527/frontend/public/index.html frontend/public/index.html
cp versions/v1.0-270527/docker-compose.yml        docker-compose.yml

# Rebuild
docker compose build --no-cache backend frontend
docker compose up -d
```

---

## How to create the next checkpoint

When the next version is stable:
```bash
# Replace the date and version number
cp -r versions/v1.0-270527 versions/v1.1-DDMMYY
# Then edit CHECKPOINT.md inside the new folder to document what changed
```
