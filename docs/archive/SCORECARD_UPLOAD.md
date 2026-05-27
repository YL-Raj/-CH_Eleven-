# Scorecard Upload Guide – CH_Eleven Admin Panel

## Overview
The scorecard upload feature allows admins to bulk-upload player stats from inning data (1st or 2nd). Instead of manually editing each player, paste JSON scorecard data and the system auto-populates:
- Batting stats (runs, balls, fours, sixes, ducks)
- Bowling stats (wickets, overs, maidens, runs conceded)
- All player fantasy points recalculate automatically

---

## JSON Format

### Required Fields for Each Inning

```json
{
  "inning": 1,
  "team": "Team Name (optional)",
  "batting": [
    {
      "batsman": "Player Name (must match DB player name)",
      "runs": 50,
      "balls": 30,
      "4s": 5,
      "6s": 1,
      "minutes": 15,
      "status": "not out" (or dismissal text)
    }
  ],
  "bowling": [
    {
      "bowler": "Bowler Name (must match DB player name)",
      "overs": 2.0,
      "maidens": 0,
      "runs": 25,
      "wickets": 2,
      "0s": 0,
      "4s": 1,
      "6s": 0
    }
  ]
}
```

### Field Explanations

**Batting:**
- `batsman` — Player name (must match exactly or close to DB player name)
- `runs` — Total runs scored
- `balls` — Balls faced
- `4s` — Number of fours hit
- `6s` — Number of sixes hit
- `status` — Dismissal (e.g., "b Bowler Name", "lbw", "not out")

**Bowling:**
- `bowler` — Player name
- `overs` — Overs bowled (decimal format: 4.2 = 4 overs 2 balls)
- `maidens` — Maiden overs
- `runs` — Runs conceded
- `wickets` — Wickets taken

---

## Examples

### 1st Inning Scorecard (JSON)

```json
{
  "inning": 1,
  "team": "TEAM RAHUL DAVID d Wall",
  "captain": "Arun (ak)",
  "total_runs": 120,
  "total_wickets": 10,
  "overs": 7.0,
  "batting": [
    {"batsman": "Yogesh Ragavan", "runs": 18, "balls": 7, "4s": 3, "6s": 0, "status": "b Lazy Nani"},
    {"batsman": "Venkatesh", "runs": 22, "balls": 6, "4s": 2, "6s": 2, "status": "b Ghost Ryder"},
    {"batsman": "Raj007", "runs": 30, "balls": 7, "4s": 1, "6s": 2, "status": "not out"}
  ],
  "bowling": [
    {"bowler": "Monika Chill", "overs": 1.0, "maidens": 0, "runs": 12, "wickets": 4},
    {"bowler": "Ghost Ryder", "overs": 1.0, "maidens": 0, "runs": 14, "wickets": 2},
    {"bowler": "AKHIL R", "overs": 1.0, "maidens": 0, "runs": 17, "wickets": 2}
  ]
}
```

### 2nd Inning Scorecard (JSON)

```json
{
  "inning": 2,
  "team": "Team Azharuddin",
  "captain": "Lazy Nani",
  "total_runs": 95,
  "total_wickets": 10,
  "overs": 6.1,
  "batting": [
    {"batsman": "Lazy Nani", "runs": 2, "balls": 2, "4s": 0, "6s": 0, "status": "b Innocent"},
    {"batsman": "Bunty", "runs": 5, "balls": 3, "4s": 0, "6s": 0, "status": "b Vicky MSV"},
    {"batsman": "Paaru Chowdary", "runs": 22, "balls": 8, "4s": 0, "6s": 1, "status": "b Rana Billa"},
    {"batsman": "Lucky666", "runs": 12, "balls": 3, "4s": 0, "6s": 2, "status": "b ARUN (Ak)"}
  ],
  "bowling": [
    {"bowler": "Innocent", "overs": 1.0, "maidens": 0, "runs": 15, "wickets": 1},
    {"bowler": "TED", "overs": 1.0, "maidens": 0, "runs": 15, "wickets": 2},
    {"bowler": "Raj007", "overs": 0.1, "maidens": 0, "runs": 0, "wickets": 1}
  ]
}
```

---

## Steps to Upload Scorecard

### Via Admin Panel (Web UI)

1. Log into Admin panel with your admin key (ch11-admin-2026)
2. Scroll to "Upload scorecard (1st/2nd inning)" section
3. **Select inning**: Choose "1st Inning" or "2nd Inning" from dropdown
4. **Paste JSON**: Copy-paste your scorecard JSON into the textarea
5. **Click "Process scorecard"**
6. System will:
   - Parse all batting and bowling stats
   - Match player names to database
   - Update all player stats automatically
   - Report any unmatched players
7. Return to Leaderboard or Players tab to see updated fantasy points

### Player Name Matching

- **Exact match priority**: If your DB has player "Raj007" and scorecard has "Raj007", it matches perfectly
- **Fuzzy match fallback**: If scorecard has "Raj 007" and DB has "Raj007", system will try to match
- **Unmatched players**: If a scorecard player can't be found in DB, they're listed in the response (⚠ Unmatched: Player Name)

**Tip**: Before uploading, ensure your player names in the scorecard exactly match your DB player names. You can check the "Players" tab to see all registered names.

---

## CSV Format (Alternative)

If you prefer CSV instead of JSON:

```csv
[batting]
Batsman,Runs,Balls,4s,6s,Minutes,Status,Team
Yogesh Ragavan,18,7,3,0,5,b Lazy Nani,RHB
Venkatesh,22,6,2,2,2,b Ghost Ryder,RHB
Raj007,30,7,1,2,11,not out,RHB

[bowling]
Bowler,Overs,Maidens,Runs,Wickets,Team
Monika Chill,1.0,0,12,4
Ghost Ryder,1.0,0,14,2
AKHIL R,1.0,0,17,2
```

---

## What Gets Updated

When you upload a scorecard, these player fields are **updated** (cumulative across innings):

### Batting Stats
- `runs` += scorecard runs
- `balls_faced` += scorecard balls
- `fours` += scorecard 4s
- `sixes` += scorecard 6s
- `duck` = true (if status contains "duck")

### Bowling Stats
- `wickets` += scorecard wickets
- `overs_bowled` += scorecard overs
- `runs_conceded` += scorecard runs conceded
- `maidens` += scorecard maidens

### Fantasy Points
All fantasy points are **recalculated automatically** using your scoring engine rules.

---

## Sample Data Files

Pre-made sample files are included:
- `scorecard-sample-1st-inning.json` — 1st inning example
- `scorecard-sample-2nd-inning.json` — 2nd inning example

Download or view these in the project root to see the exact format expected.

---

## API Endpoint (Advanced)

If integrating programmatically:

**Endpoint:** `POST /api/scorecard/upload`

**Headers:**
```
x-admin-key: ch11-admin-2026
Content-Type: application/json
```

**Request Body:**
```json
{
  "data": "{...scorecard JSON...}",
  "format": "json",
  "inning": 1
}
```

**Response:**
```json
{
  "success": true,
  "inning": 1,
  "updated": 11,
  "unmatched": [],
  "players": [
    {"id": 1, "name": "Raj007", "runs": 30, "wickets": 0},
    {"id": 2, "name": "Monika Chill", "runs": 0, "wickets": 4}
  ]
}
```

---

## Troubleshooting

### "⚠ Unmatched: Player Name"
- Check spelling in scorecard vs. your Players list
- Use exact names from the Players tab
- Add the player first in the "Add player" section if missing

### Fantasy points not updating
- Ensure scorecard data was processed (check success message)
- Refresh the page or go to Leaderboard tab to see updated points
- Check that overs and balls are valid numbers

### Import fails with JSON error
- Validate your JSON format (use a JSON validator tool)
- Ensure all required fields are present
- No trailing commas in JSON arrays

---

## Live Match Workflow

1. **Before match starts** → Upload player list and set match status to "Upcoming"
2. **During match** → Update match status to "Live" (blocks new registrations)
3. **After 1st inning** → Upload 1st inning scorecard (updates player stats mid-match, leaderboard reflects live points)
4. **After 2nd inning** → Upload 2nd inning scorecard (final stats)
5. **Match complete** → Set status to "Completed", leaderboard shows final rankings

---

## Next Steps

- Download sample scorecard files
- Test upload with sample data
- Connect to your live cricket API to auto-generate scorecards
- Set up automated inning-end uploads via webhooks

