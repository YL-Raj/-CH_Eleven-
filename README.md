# CH_Eleven — Fantasy Cricket Platform

> **Copyright © 2026 RAJ.Y — All rights reserved.**  
> Built for ICT practice tournaments. Unauthorised redistribution prohibited.

---

## Overview

CH_Eleven is a full-stack fantasy cricket web app. Participants pick an 11-player team before a match and compete on a live leaderboard as real match stats are uploaded inning-by-inning.

| Feature | Detail |
|---|---|
| **Leaderboard** | Auto-ranked with podium view, live 30-second refresh |
| **Team Registration** | Pick 11 players, Captain (2×) + Vice-Captain (1.5×) |
| **Admin Panel** | Manage match, squad, stats, contest settings |
| **Innings Pipeline** | Upload 1st innings → Live · Upload 2nd innings → Final results |
| **Bulk Upload** | Drag-and-drop CSV/JSON scorecard files |
| **OCR Service** | PDF/Image scorecard extraction via Tesseract |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single-file SPA |
| Backend API | Node.js 20 + Express + PostgreSQL |
| OCR Service | Python 3.11 + Flask + Tesseract |
| Database | PostgreSQL 16 |
| Infrastructure | Docker Compose |

---

## Quick Start

```bash
git clone https://github.com/RAJ-Y/ch-eleven.git
cd ch-eleven
docker compose up -d --build
```

Open **http://localhost:3000** — admin key: `ch11-admin-2026`

---

## Match Workflow

```
1. Admin → Start New Game   (clears previous session)
2. Attach Squad CSV/JSON    (up to 30 players, 15 per team)
3. Participants register    (pick 11, choose Captain + VC)
4. Upload 1st Innings CSV   → match LIVE, leaderboard updates
5. Upload 2nd Innings CSV   → match COMPLETED, final results
```

---

## Scoring System

### Batting
| Event | Points |
|---|---|
| Run | +1 · Boundary +1 · Six +2 |
| Half-century | +8 · Century +16 |
| Duck | −2 |
| Strike Rate < 50 (≥10 balls) | −6 / SR 50-59: −4 / SR 60-69: −2 |
| Strike Rate 120-129 | +1 / 130-149: +2 / 150+: +4 |

### Bowling
| Event | Points |
|---|---|
| Wicket | +25 · 3W: +4 · 4W: +8 · 5W: +16 |
| Maiden | +8 |
| Economy < 5 (≥2 overs) | +6 / 5-5.99: +4 / 6-7: +2 |
| Economy 10-10.99 | −2 / 11-11.99: −4 / 12+: −6 |

### Fielding
| Event | Points |
|---|---|
| Catch | +8 · Stumping: +12 · Run-out direct: +12 · indirect: +6 |

**Captain = 2× points · Vice-Captain = 1.5× points**

---

## File Templates

| File | Use |
|---|---|
| `templates/squad-template.csv` | Pre-match squad (both teams) |
| `templates/1st-innings-template.csv` | 1st innings batting + bowling |
| `templates/2nd-innings-template.csv` | 2nd innings batting + bowling |
| `templates/match-template.json` | Full match in JSON format |

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/api/match` | — | Match info |
| PUT | `/api/match` | Admin | Update match |
| POST | `/api/match/reset` | Admin | New game — clear all |
| POST | `/api/match/bulk-upload` | Admin | Upload innings file |
| GET | `/api/players` | — | Players + points |
| POST | `/api/squad/upload` | Admin | Load squad from file |
| DELETE | `/api/players` | Admin | Clear all players |
| GET | `/api/leaderboard` | — | Ranked leaderboard |
| POST | `/api/teams` | — | Register contest team |

---

## Project Structure

```
ch-eleven/
├── backend/
│   ├── server.js            # Express API — all routes + scoring engine
│   ├── scorecard-parser.js  # CSV/JSON scorecard parser
│   ├── schema.sql           # PostgreSQL schema + seed data
│   └── Dockerfile
├── frontend/
│   ├── public/index.html    # Single-file SPA
│   └── Dockerfile
├── ocr-service/
│   ├── ocr_service.py       # Flask OCR + CSV parse service
│   ├── match_data_parser.py # Full match data parser
│   ├── scorecard_parser.py  # Text scorecard parser
│   └── Dockerfile
├── templates/               # Ready-to-fill CSV/JSON match templates
├── docs/                    # Setup and deployment guides
├── docker-compose.yml
└── .env.example
```

---

## Rebuild

```bash
docker compose build --no-cache backend ocr-service frontend
docker compose up -d
docker ps   # all should show (healthy)
```

---

## License

**Copyright © 2026 RAJ.Y — All rights reserved.**  
Proprietary software. No redistribution or reuse without written permission.
