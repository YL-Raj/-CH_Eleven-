// OCR Integration Module - Routes for file upload and OCR processing

const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const router = express.Router();

// Multer config for file uploads
const upload = multer({ 
  dest: '/tmp/uploads',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'csv'];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${ext}`));
    }
  }
});

// Match player name from scorecard to DB
function matchPlayer(playerName, dbPlayers) {
  if (!playerName) return null;
  const normalized = playerName.toLowerCase().trim();
  
  // Exact match
  let match = dbPlayers.find(p => p.name.toLowerCase() === normalized);
  if (match) return match;
  
  // Partial match
  match = dbPlayers.find(p => 
    p.name.toLowerCase().includes(normalized) || 
    normalized.includes(p.name.toLowerCase())
  );
  
  return match || null;
}

// Build player update from scorecard data
function buildPlayerUpdate(scorecardPlayer, dbPlayer, type) {
  if (!dbPlayer) return null;
  
  const update = {
    id: dbPlayer.id,
    ...dbPlayer,
  };

  if (type === 'batting') {
    update.runs = (update.runs || 0) + (scorecardPlayer.runs || 0);
    update.balls_faced = (update.balls_faced || 0) + (scorecardPlayer.balls || 0);
    update.fours = (update.fours || 0) + (scorecardPlayer['4s'] || 0);
    update.sixes = (update.sixes || 0) + (scorecardPlayer['6s'] || 0);
    
    if (scorecardPlayer.status && scorecardPlayer.status.toLowerCase().includes('duck')) {
      update.duck = true;
    }
  }

  if (type === 'bowling') {
    update.wickets = (update.wickets || 0) + (scorecardPlayer.wickets || 0);
    update.overs_bowled = (update.overs_bowled || 0) + (scorecardPlayer.overs || 0);
    update.runs_conceded = (update.runs_conceded || 0) + (scorecardPlayer.runs || 0);
    update.maidens = (update.maidens || 0) + (scorecardPlayer.maidens || 0);
  }

  return update;
}

// ─── OCR Extract Endpoint ────────────────────────────────────────────────────
router.post('/scorecard/ocr-upload', async (req, res, pool, adminOnly) => {
  upload.single('file')(req, res, async (err) => {
    // Auth check
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_SECRET || 'ch11-admin-2026';
    if (!adminKey || adminKey !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const inning = parseInt(req.body.inning) || 1;
      
      console.log(`[OCR] Processing file: ${req.file.originalname}, Inning: ${inning}`);

      // Send to OCR microservice
      const form = new FormData();
      form.append('file', fs.createReadStream(req.file.path));
      form.append('inning', inning);

      const ocrRes = await fetch('http://ocr-service:5000/api/ocr/extract', {
        method: 'POST',
        headers: {
          'x-admin-key': expectedKey,
          ...form.getHeaders()
        },
        body: form,
        timeout: 60000, // 60 seconds
      });

      if (!ocrRes.ok) {
        const error = await ocrRes.json();
        console.error('[OCR] Error:', error);
        return res.status(ocrRes.status).json(error);
      }

      const ocrData = await ocrRes.json();
      const scorecard = ocrData.scorecard;

      console.log(`[OCR] Extracted - Batting: ${scorecard.batting?.length || 0}, Bowling: ${scorecard.bowling?.length || 0}, Confidence: ${scorecard.confidence}`);

      // Validate extracted data
      if (!scorecard.batting || !Array.isArray(scorecard.batting) || scorecard.batting.length === 0) {
        return res.status(400).json({ 
          error: 'No batting data extracted from file. Try a clearer image or different format.',
          confidence: scorecard.confidence
        });
      }

      // Get all players from DB
      const { rows: players } = await pool.query('SELECT * FROM players');
      const updates = [];
      const unmatched = [];

      // Process batting data
      for (const bat of scorecard.batting) {
        const matched = matchPlayer(bat.batsman, players);
        if (!matched) {
          unmatched.push(bat.batsman);
          continue;
        }
        
        const update = buildPlayerUpdate(bat, matched, 'batting');
        if (update) updates.push(update);
      }

      // Process bowling data
      for (const bowl of scorecard.bowling) {
        const matched = matchPlayer(bowl.bowler, players);
        if (!matched) {
          unmatched.push(bowl.bowler);
          continue;
        }
        
        const existing = updates.find(u => u.id === matched.id);
        if (existing) {
          const bowlUpdate = buildPlayerUpdate(bowl, matched, 'bowling');
          Object.assign(existing, bowlUpdate);
        } else {
          const update = buildPlayerUpdate(bowl, matched, 'bowling');
          if (update) updates.push(update);
        }
      }

      // Bulk update database
      const results = [];
      for (const upd of updates) {
        try {
          const { rows } = await pool.query(
            `UPDATE players SET
              runs=$1, balls_faced=$2, fours=$3, sixes=$4, duck=$5,
              wickets=$6, overs_bowled=$7, runs_conceded=$8, maidens=$9
             WHERE id=$10 RETURNING *`,
            [
              upd.runs || 0,
              upd.balls_faced || 0,
              upd.fours || 0,
              upd.sixes || 0,
              upd.duck || false,
              upd.wickets || 0,
              upd.overs_bowled || 0,
              upd.runs_conceded || 0,
              upd.maidens || 0,
              upd.id
            ]
          );
          if (rows[0]) results.push(rows[0]);
        } catch (e) {
          console.error(`[OCR] Update error for player ${upd.id}:`, e);
        }
      }

      // Cleanup
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.warn('[OCR] Cleanup warning:', e.message);
      }

      console.log(`[OCR] Complete - Updated ${results.length} players, Unmatched: ${unmatched.length}`);

      res.json({
        success: true,
        inning,
        source: 'ocr',
        confidence: scorecard.confidence,
        updated: results.length,
        unmatched: unmatched.length > 0 ? unmatched : [],
        players: results.map(p => ({
          id: p.id,
          name: p.name,
          runs: p.runs,
          wickets: p.wickets,
          fantasy_points: p.fantasy_points
        }))
      });

    } catch (e) {
      console.error('[OCR] Exception:', e);
      
      // Cleanup on error
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanup_err) {
        console.warn('[OCR] Cleanup error:', cleanup_err.message);
      }

      res.status(500).json({ error: `Processing failed: ${e.message}` });
    }
  });
});

module.exports = { router, upload };
