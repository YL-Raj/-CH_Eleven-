// Backend endpoint for bulk match data upload (Add to server.js)

app.post("/api/match/bulk-upload", adminOnly, async (req, res) => {
  const multer = require("multer");
  const upload = multer({ 
    dest: "/tmp/uploads",
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      const fs = require('fs');
      const ext = req.file.originalname.split('.').pop().toLowerCase();
      const content = fs.readFileSync(req.file.path, 'utf-8');
      
      // Parse based on format
      let matchData = {};
      
      if (ext === 'json') {
        matchData = JSON.parse(content);
      } else if (ext === 'csv') {
        // Backend CSV parser would go here
        // For now, use the Python OCR service
        matchData = await parseCSVData(content);
      } else {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Extract and validate data
      const validation = validateMatchData(matchData);
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Validation failed',
          details: validation.errors 
        });
      }

      // Get database connection
      const { rows: players } = await pool.query("SELECT * FROM players");

      // 1. Update/Create Match Info
      if (matchData.match_summary) {
        const summary = matchData.match_summary;
        await pool.query(
          `UPDATE match_info SET 
            name=$1, team_a=$2, team_b=$3, 
            match_date=$4, venue=$5, overs=$6, status=$7
           WHERE id=1`,
          [
            summary.match || '',
            summary.team1_name || '',
            summary.team2_name || '',
            summary.date || new Date(),
            summary.ground || '',
            parseInt(summary.overs) || 20,
            'upcoming'
          ]
        );
      }

      let playersCreated = 0;
      let statsUpdated = 0;

      // 2. Create Players from Squad if not exist
      if (matchData.squads) {
        const allSquadPlayers = [
          ...(matchData.squads.team1?.players || []),
          ...(matchData.squads.team2?.players || [])
        ];

        for (const playerName of allSquadPlayers) {
          if (!players.find(p => p.name.toLowerCase() === playerName.toLowerCase())) {
            await pool.query(
              `INSERT INTO players (name, cric_team, role) VALUES ($1, $2, $3)
               ON CONFLICT DO NOTHING`,
              [playerName.trim(), matchData.match_summary?.team1_name || '', 'BAT']
            );
            playersCreated++;
            players.push({ name: playerName }); // Add to local list
          }
        }
      }

      // 3. Extract and apply player stats from innings
      if (matchData.innings) {
        const stats = {};

        // Collect batting stats
        for (const inning of ['first_innings', 'second_innings']) {
          const innings = matchData.innings[inning];
          
          if (innings?.batting) {
            for (const bat of innings.batting) {
              const player = bat.batsman;
              if (!player) continue;
              
              if (!stats[player]) {
                stats[player] = {
                  runs: 0, balls: 0, fours: 0, sixes: 0,
                  wickets: 0, overs: 0, runs_conceded: 0, maidens: 0, duck: false
                };
              }
              
              stats[player].runs += bat.runs || 0;
              stats[player].balls += bat.balls || 0;
              stats[player].fours += bat.fours || 0;
              stats[player].sixes += bat.sixes || 0;
              
              if (bat.status && bat.status.toLowerCase().includes('duck')) {
                stats[player].duck = true;
              }
            }
          }

          // Collect bowling stats
          if (innings?.bowling) {
            for (const bowl of innings.bowling) {
              const player = bowl.bowler;
              if (!player) continue;
              
              if (!stats[player]) {
                stats[player] = {
                  runs: 0, balls: 0, fours: 0, sixes: 0,
                  wickets: 0, overs: 0, runs_conceded: 0, maidens: 0, duck: false
                };
              }
              
              stats[player].wickets += bowl.wickets || 0;
              stats[player].overs += bowl.overs || 0;
              stats[player].runs_conceded += bowl.runs || 0;
              stats[player].maidens += bowl.maidens || 0;
            }
          }
        }

        // Update players with stats
        for (const [playerName, playerStats] of Object.entries(stats)) {
          const dbPlayer = players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase()
          );
          
          if (dbPlayer) {
            await pool.query(
              `UPDATE players SET
                runs=$1, balls_faced=$2, fours=$3, sixes=$4, duck=$5,
                wickets=$6, overs_bowled=$7, runs_conceded=$8, maidens=$9
               WHERE id=$10`,
              [
                playerStats.runs || 0,
                playerStats.balls || 0,
                playerStats.fours || 0,
                playerStats.sixes || 0,
                playerStats.duck || false,
                playerStats.wickets || 0,
                playerStats.overs || 0,
                playerStats.runs_conceded || 0,
                playerStats.maidens || 0,
                dbPlayer.id
              ]
            );
            statsUpdated++;
          }
        }
      }

      // Cleanup
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('Cleanup error:', e.message);
      }

      res.json({
        success: true,
        source: 'bulk_upload',
        validation: validation.summary,
        players_created: playersCreated,
        stats_updated: statsUpdated,
        file: req.file.originalname
      });

    } catch (e) {
      console.error('Bulk upload error:', e);
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanup_err) {}
      
      res.status(500).json({ error: `Processing failed: ${e.message}` });
    }
  });
});

// Helper: Validate match data structure
function validateMatchData(data) {
  const errors = [];
  const warnings = [];
  
  if (!data.match_summary?.match) errors.push('Missing match name');
  if (!data.match_summary?.team1_name) errors.push('Missing Team 1');
  if (!data.match_summary?.team2_name) errors.push('Missing Team 2');
  
  if (!data.squads?.team1?.players?.length) warnings.push('No Team 1 squad');
  if (!data.squads?.team2?.players?.length) warnings.push('No Team 2 squad');
  
  if (!data.innings?.first_innings?.batting?.length) warnings.push('No 1st inning batting');
  if (!data.innings?.second_innings?.batting?.length) warnings.push('No 2nd inning batting');
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      match: data.match_summary?.match || '',
      teams: 2,
      squad_size: (data.squads?.team1?.players?.length || 0) + (data.squads?.team2?.players?.length || 0),
      batting_records: (data.innings?.first_innings?.batting?.length || 0) + (data.innings?.second_innings?.batting?.length || 0),
      bowling_records: (data.innings?.first_innings?.bowling?.length || 0) + (data.innings?.second_innings?.bowling?.length || 0),
    }
  };
}

// Helper: Parse CSV (simplified - full logic in Python)
async function parseCSVData(csvContent) {
  // Send to Python OCR service for parsing
  const FormData = require('form-data');
  const fs = require('fs');
  
  const form = new FormData();
  form.append('csv_data', csvContent);
  form.append('format', 'csv');
  
  try {
    const res = await fetch('http://ocr-service:5000/api/csv/parse', {
      method: 'POST',
      headers: { 'x-admin-key': process.env.ADMIN_SECRET || 'ch11-admin-2026', ...form.getHeaders() },
      body: form,
    });
    
    if (res.ok) {
      return await res.json();
    } else {
      throw new Error('CSV parsing service error');
    }
  } catch (e) {
    console.warn('Using fallback CSV parser:', e.message);
    return { match_summary: {}, squads: {}, innings: {} };
  }
}
