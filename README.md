# CH_Eleven — Fantasy Cricket Platform

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-Proprietary-red?style=flat-square"/>
</p>

<p align="center">
  A self-hosted fantasy cricket platform for friends-circle tournaments.<br/>
  Pick your 11, watch the live leaderboard, settle the score.
</p>

---

## What it does

CH_Eleven runs an end-to-end fantasy cricket contest in a single Docker stack. Before a match, participants register a team of 11 players with a Captain (2×) and Vice-Captain (1.5×). As the real match is played, the admin uploads scorecard CSVs innings-by-innings — the leaderboard updates live and locks in final results after the 2nd innings.

---

## Features

| | Feature | Detail |
|---|---|---|
| 🏏 | **Live Leaderboard** | Auto-ranked with podium view, refreshes every 30 seconds |
| 📋 | **Team Registration** | Pick 11 from squad, choose Captain + Vice-Captain |
| 📁 | **Bulk Upload** | Drag-and-drop CSV or JSON scorecard files |
| 🔢 | **Innings Pipeline** | 1st innings → LIVE · 2nd innings → FINAL |
| 🔍 | **View Math** | Per-player point breakdown accordion on the leaderboard |
| 🛠 | **Admin Panel** | Manage match info, squad, stats, contest settings |
| 🤖 | **OCR Service** | Python/Flask service parses scorecards with fuzzy name matching |
| 📥 | **Import Team** | Register tab accepts a CSV/JSON of squad members for quick selection |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML / CSS / JS — single-file SPA served via nginx |
| Backend API | Node.js 20 + Express + PostgreSQL (pg) |
| OCR / Parser | Python 3.11 + Flask + Tesseract |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose |

---

## Quick Start

**Prerequisites:** Docker Desktop installed and running.

```bash
git clone https://github.com/YL-Raj/-CH_Eleven-.git
cd -CH_Eleven-

cp .env.example .env          # edit values if needed

docker compose up -d --build
```

Open **http://localhost:3000**

Default admin key: `ch11-admin-2026` (set in `.env`)

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values before the first run:

```env
POSTGRES_DB=ch_eleven
POSTGRES_USER=admin
POSTGRES_PASSWORD=your_secure_password
ADMIN_SECRET=your_admin_key
MAX_ENTRIES=100
```

> `.env` is blocked by `.gitignore` — it will never be committed.

---

## Match Workflow

```
1. Admin → Start New Game        clear previous session
2. Admin → Upload Squad CSV      load up to 30 players (15 per team)
3. Participants → Register       pick 11, set Captain + Vice-Captain
4. Admin → Upload 1st Innings    match goes LIVE, leaderboard activates
5. Admin → Upload 2nd Innings    match COMPLETED, final standings locked
```

---

## Scoring System

### Batting
| Event | Points |
|---|---|
| Run scored | +1 |
| Boundary (4) | +1 bonus |
| Six (6) | +2 bonus |
| Half-century (50+) | +8 |
| Century (100+) | +16 |
| Duck (dismissed for 0) | −2 |
| Strike Rate < 50 (min 10 balls) | −6 |
| Strike Rate 50–59 | −4 |
| Strike Rate 60–69 | −2 |
| Strike Rate 120–129 | +1 |
| Strike Rate 130–149 | +2 |
| Strike Rate 150+ | +4 |

### Bowling
| Event | Points |
|---|---|
| Wicket | +25 |
| 3-wicket haul | +4 bonus |
| 4-wicket haul | +8 bonus |
| 5-wicket haul | +16 bonus |
| Maiden over | +8 |
| Economy < 5 (min 2 overs) | +6 |
| Economy 5–5.99 | +4 |
| Economy 6–7 | +2 |
| Economy 10–10.99 | −2 |
| Economy 11–11.99 | −4 |
| Economy 12+ | −6 |

### Fielding
| Event | Points |
|---|---|
| Catch | +8 |
| Stumping | +12 |
| Run-out (direct) | +12 |
| Run-out (indirect) | +6 |

**Captain = 2× total points · Vice-Captain = 1.5× total points**

---

## CSV Format

### Squad (`templates/squad.csv`)
```
TEAM,KL RAHUL
Player Name,ROLE
Rahul Kumar,BAT
...
TEAM,Team Virat
Player Name,ROLE
Virat Singh,BAT
...
```
Roles: `BAT` `BOWL` `AR` `WK`

### Innings (`templates/Squ1st.csv` / `Squ2nd.csv`)
```
MATCH SUMMARY,Match,Team A vs Team B
MATCH SUMMARY,Team 1 Name,Team A
MATCH SUMMARY,Team 2 Name,Team B
MATCH SUMMARY,Inning,1
1ST INNINGS BATTING,Batsman,Status,Runs,Balls,4s,6s
1ST INNINGS BATTING,Rahul Kumar,b Bowler,45,32,4,2
...
1ST INNINGS BOWLING,Bowler,Overs,Runs,Wickets,Maidens
1ST INNINGS BOWLING,Priya Sharma,4,28,2,1
...
```

---

## Project Structure

```
-CH_Eleven-/
├── backend/
│   ├── server.js            # Express API — all routes + scoring engine
│   ├── schema.sql           # PostgreSQL schema + seed data
│   └── Dockerfile
├── frontend/
│   ├── public/index.html    # Single-file SPA
│   └── Dockerfile
├── ocr-service/
│   ├── ocr_service.py       # Flask service entry point
│   ├── match_data_parser.py # CSV/JSON full match parser
│   └── Dockerfile
├── templates/               # Sample CSV/JSON scorecards and squad files
├── docs/                    # Setup and deployment guides
├── docker-compose.yml
├── .env.example
└── setup.sh
```

---

## Useful Commands

```bash
# Rebuild after code changes
docker compose build --no-cache backend frontend
docker compose up -d

# View live backend logs
docker compose logs -f backend

# Full reset (keeps DB volume)
docker compose restart

# Nuke everything including DB
docker compose down -v
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/api/match` | — | Match info |
| POST | `/api/match/reset` | Admin | New game — clear all |
| POST | `/api/match/bulk-upload` | Admin | Upload innings CSV/JSON |
| GET | `/api/players` | — | Players + fantasy points |
| POST | `/api/squad/upload` | Admin | Load squad from file |
| GET | `/api/leaderboard` | — | Ranked leaderboard |
| POST | `/api/teams` | — | Register contest team |
| GET | `/api/teams/count` | — | Slots remaining |

Admin auth: `x-admin-key: <ADMIN_SECRET>` header.

---

## License

**Copyright © 2026 RAJ.Y — All rights reserved.**  
Proprietary software. No redistribution or reuse without written permission.

---

<p align="center">Developed with ❤️ by <strong>Loki.Y</strong></p>
