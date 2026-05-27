// Add this JavaScript code to the Admin rendering section in frontend/public/index.html
// Insert BEFORE the closing script tag, after the saveSettings function

// ─── File Upload Handlers ────────────────────────────────────────────────────
let selectedFile = null;
let parsedData = null;

function handleDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    selectedFile = files[0];
    handleFilePreview();
  }
}

function handleFileSelect(event) {
  selectedFile = event.target.files[0];
  if (selectedFile) {
    handleFilePreview();
  }
}

function handleFilePreview() {
  if (!selectedFile) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (ext === 'json') {
        parsedData = JSON.parse(content);
      } else if (ext === 'csv') {
        parsedData = { csv_content: content };
      }
      showFilePreview();
    } catch (err) {
      showValidationError(`Invalid ${ext.toUpperCase()}: ${err.message}`);
    }
  };
  reader.readAsText(selectedFile);
}

function showFilePreview() {
  if (!parsedData) return;
  document.getElementById('file-preview').style.display = 'block';
  const summary = parsedData.match_summary || {};
  const squads = parsedData.squads || {};
  const innings = parsedData.innings || {};
  const team1Players = squads.team1?.players?.length || 0;
  const team2Players = squads.team2?.players?.length || 0;
  const inningsRecs = (innings.first_innings?.batting?.length || 0) + (innings.second_innings?.batting?.length || 0);
  document.getElementById('preview-match').textContent = summary.match || 'N/A';
  document.getElementById('preview-teams').textContent = `${summary.team1_name || '?'} vs ${summary.team2_name || '?'}`;
  document.getElementById('preview-players').textContent = `${team1Players + team2Players}`;
  document.getElementById('preview-innings').textContent = `${inningsRecs}`;
  const validation = parsedData.validation || {};
  let msgHtml = '';
  if (validation.errors && validation.errors.length > 0) {
    msgHtml += `<div class="error-msg">⚠ Errors: ${validation.errors.join(', ')}</div>`;
  }
  if (validation.warnings && validation.warnings.length > 0) {
    msgHtml += `<div style="color: #ff9800; font-size: 11px; margin-top: 5px;">⚡ Warnings: ${validation.warnings.join(', ')}</div>`;
  }
  if (validation.valid) {
    msgHtml += `<div class="success-msg">✓ All validations passed</div>`;
  }
  document.getElementById('validation-messages').innerHTML = msgHtml;
}

function clearFilePreview() {
  document.getElementById('file-preview').style.display = 'none';
  document.getElementById('upload-status').innerHTML = '';
  selectedFile = null;
  parsedData = null;
  document.getElementById('file-input').value = '';
}

async function uploadMatchData() {
  if (!selectedFile || !parsedData) {
    alert('No file selected');
    return;
  }
  const ext = selectedFile.name.split('.').pop().toLowerCase();
  document.getElementById('upload-btn').disabled = true;
  try {
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('format', ext === 'csv' ? 'csv' : 'json');
    if (ext !== 'csv') {
      formData.append('data', JSON.stringify(parsedData));
    }
    const res = await fetch(`${API}/match/bulk-upload`, {
      method: 'POST',
      headers: { 'x-admin-key': state.adminKey },
      body: formData,
    });
    const result = await res.json();
    if (!res.ok) {
      showUploadError(result.error || 'Upload failed');
      return;
    }
    showUploadSuccess(result);
    clearFilePreview();
    await fetchAll();
  } catch (e) {
    showUploadError(e.message);
  } finally {
    document.getElementById('upload-btn').disabled = false;
  }
}

function showValidationError(msg) {
  const div = document.getElementById('validation-messages');
  div.innerHTML = `<div class="error-msg">${msg}</div>`;
  document.getElementById('file-preview').style.display = 'block';
}

function showUploadSuccess(result) {
  const div = document.getElementById('upload-status');
  let html = `<div class="success-msg">✓ Upload successful!</div>`;
  if (result.players_created) html += `<div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Created: ${result.players_created} players</div>`;
  if (result.stats_updated) html += `<div style="font-size: 11px; color: var(--muted);">Updated: ${result.stats_updated} stats</div>`;
  div.innerHTML = html;
}

function showUploadError(msg) {
  const div = document.getElementById('upload-status');
  div.innerHTML = `<div class="error-msg">⚠ ${msg}</div>`;
}

function startNewGame() {
  const matchName = prompt('Enter match name:');
  if (!matchName) return;
  const team1 = prompt('Enter Team 1 name:');
  if (!team1) return;
  const team2 = prompt('Enter Team 2 name:');
  if (!team2) return;
  document.getElementById('m-name').value = matchName;
  document.getElementById('m-ta').value = team1;
  document.getElementById('m-tb').value = team2;
  document.getElementById('m-status').value = 'upcoming';
  saveMatch();
  document.getElementById('match-status-display').textContent = `${matchName}: ${team1} vs ${team2} (Upcoming)`;
}
