<div align="center">

# ⚡ CH_Eleven

### Self-hosted Fantasy Cricket for your friends circle

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](./LICENSE)

*Pick your 11. Watch the live leaderboard. Settle the score.*

</div>

---

## What it does

CH_Eleven runs a complete fantasy cricket contest inside a single Docker stack — no third-party fantasy platform, no subscription, no data shared with anyone. Before a match, participants register a squad of 11 with a Captain (2×) and Vice-Captain (1.5×). As the real match plays out, the admin uploads scorecard CSVs innings-by-innings and the leaderboard updates live.

---

## Features

| | Feature | Detail |
|---|---|---|
| 🏆 | **Live Leaderboard** | Auto-ranked with gold/silver/bronze podium, refreshes every 30s |
| 🧮 | **View Math** | Every participant can expand their row and see the exact point breakdown |
| 📋 | **Team Registration** | Pick 11 from squad, set Captain + Vice-Captain before the match |
| 🔒 | **Auto Lock-in** | Registration closes the moment the 1st innings is uploaded |
| 🚫 | **Duplicate Guard** | One entry per name — re-registering updates picks, never duplicates |
| 📁 | **CSV Upload** | Drag-and-drop scorecard CSVs — 5 formats auto-detected |
| 📊 | **Player Scorecard** | Full stats: runs, balls, SR, wickets, overs, economy, fantasy points |
| 🏏 | **Best Performances** | Auto-highlights top batsmen and bowlers after each innings |
| 🌐 | **Public Access** | Share via Cloudflare Tunnel — friends join from any device |

---

## Tech Stack

```
┌─────────────────────────────────────────────────┐
│              Browser  (any device)               │
└────────────────────┬────────────────────────────┘
                     │  HTTPS (Cloudflare Tunnel)
┌────────────────────▼────────────────────────────┐
│          nginx  ·  port 3000                     │
│          Serves HTML/JS  ·  Proxies /api         │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────┐
│          Node.js / Express  ·  port 3001         │
│          REST API  ·  Scoring Engine  ·  Parser  │
└──────────┬──────────────────────┬───────────────┘
           │                      │
┌──────────▼────────┐  ┌──────────▼──────────────┐
│  PostgreSQL 16    │  │  Python / Flask  · 5000  │
│  port 5432        │  │  OCR · PDF Parser        │
└───────────────────┘  └─────────────────────────┘
```

---

## Scoring Engine

Points calculated automatically from uploaded scorecards.

**Batting** — 1pt/run · 1pt/boundary · 2pt/six · +8 at 50R · +16 at 100R · −2 duck  
**Strike Rate** *(10+ balls)* — ≥150 → +4 · ≥130 → +2 · <50 → −6  
**Bowling** — 25pt/wicket · 3W +4 · 4W +8 · 5W +16 · 8pt/maiden  
**Economy** *(2+ overs)* — <5 eco → +6 · <6 → +4 · ≥12 → −6  
**Fielding** — Catch +8 · Stumping +12 · Direct run-out +12  
**Multipliers** — Captain 2× · Vice-Captain 1.5×

---

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Git](https://git-scm.com/)

### Setup

```bash
# 1. Clone
git clone https://github.com/RAJ-Y/ch-eleven.git
cd ch-eleven

# 2. Configure environment
cp .env.example .env
# Open .env and set your own passwords

# 3. Launch
docker compose up -d

# 4. Open
# http://localhost:3000
```

### Share with friends (Cloudflare Tunnel)

```bash
# Download cloudflared.exe once from:
# https://github.com/cloudflare/cloudflared/releases/latest

.\cloudflared.exe tunnel --url http://localhost:3000
# Copy the trycloudflare.com URL and share on WhatsApp
```

---

## Match Day Workflow

```
Admin                             Players
  │                                 │
  ├── Start New Game                │
  ├── Upload Squad CSV              ├── Register → pick 11 → set C / VC
  │                                 │
  │   [Match starts]                │   [Registration locks automatically]
  │                                 │
  ├── Upload 1st Innings CSV        ├── Leaderboard updates live
  │                                 │
  │   [Match ends]                  │
  │                                 │
  └── Upload 2nd Innings CSV        └── Final leaderboard · locked
```

---

## CSV Templates

Templates are in the `templates/` folder — fill and upload:

| File | Purpose |
|---|---|
| `squad-template.csv` | Both teams + player roles (BAT/BOWL/AR/WK) |
| `1st-innings-template.csv` | Batting + bowling stats, 1st innings |
| `2nd-innings-template.csv` | Batting + bowling stats + match result |

---

## Project Structure

```
ch-eleven/
├── backend/
│   ├── server.js           # Core API · scoring engine · CSV parser
│   └── schema.sql          # PostgreSQL schema
├── frontend/
│   ├── public/index.html   # Full single-page app
│   └── nginx.conf          # Reverse proxy → backend
├── ocr-service/
│   ├── ocr_service.py      # Flask OCR API
│   └── match_data_parser.py
├── templates/              # CSV templates for admins
├── versions/               # Restore-point snapshots
├── docker-compose.yml
└── .env.example            # Safe config template
```

---

## Versions

| Version | Date | Notes |
|---|---|---|
| v1.0 | 27 May 2026 | First live match verified · all core features working |
| v1.1 | 29 May 2026 | nginx proxy · UNIQUE constraint · podium fix · Cloudflare · cleanup |

---

## License

**Copyright © 2026 RAJ.Y — All rights reserved.**

This software is proprietary. Source is viewable for educational reference only.  
Redistribution, modification, or commercial use without explicit written permission is prohibited.

---

<div align="center">
  <sub>Developed with ❤️ by <strong>Loki.Y</strong> . SPARTAN's</sub>
</div>
