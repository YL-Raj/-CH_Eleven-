# Professional Merge Guide - Bulk Upload into Admin Panel

## One-Click Integration

Instead of creating a separate upload section, we've created **compact professional cards** that fit seamlessly into your existing admin panel.

### What Gets Added

**Two new cards between "Player points entry" and "Contest settings":**

1. **📁 Upload Complete Match Data (CSV/JSON)**
   - Drag-drop zone (compact, professional)
   - File preview with validation
   - Upload & Process button
   - Status messages

2. **🎮 Match Workflow**
   - 🆕 Start New Match (quick new game)
   - 📤 Upload Data (quick file upload)
   - Match status display

### Integration Steps

**Step 1:** Copy the HTML cards to Admin panel

In `frontend/public/index.html`, find this section in the `renderAdmin()` function:

```javascript
    <!-- Player stats -->
    <div class="card">
      <div class="card-title">Player points entry ...
      ...
    </div>

    <!-- Contest settings -->
    <div class="card">
      <div class="card-title">Contest settings</div>
```

Replace that gap with these two cards:

```html
    <!-- Bulk Upload Match Data -->
    <div class="card">
      <div class="card-title">📁 Upload Complete Match Data (CSV/JSON)</div>
      
      <div style="background: var(--bg); border: 2px dashed var(--green-mid); border-radius: 8px; padding: 15px; text-align: center; cursor: pointer;" 
           id="dropzone"
           ondrop="handleDrop(event)"
           ondragover="event.preventDefault(); event.target.style.background='var(--green-light)'"
           ondragleave="event.target.style.background='var(--bg)'">
        <div style="font-size: 24px; margin-bottom: 8px;">📤</div>
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--green-mid);">Drag & drop CSV/JSON or click</div>
        <div style="font-size: 11px; color: var(--muted); margin-bottom: 10px;">Max 50MB | Supports complete match data</div>
        <input type="file" id="file-input" style="display:none" accept=".csv,.json" onchange="handleFileSelect(event)">
        <button class="btn btn-primary btn-sm" onclick="document.getElementById('file-input').click()">Choose File</button>
      </div>

      <div id="file-preview" style="margin-top: 12px; display: none;">
        <div style="background: var(--bg); border-radius: 8px; padding: 12px; font-size: 11px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
            <div><span style="color: var(--muted);">Match</span> <div id="preview-match" style="font-size: 12px; font-weight: 600;">-</div></div>
            <div><span style="color: var(--muted);">Teams</span> <div id="preview-teams" style="font-size: 12px; font-weight: 600;">-</div></div>
            <div><span style="color: var(--muted);">Players</span> <div id="preview-players" style="font-size: 12px; font-weight: 600;">-</div></div>
            <div><span style="color: var(--muted);">Records</span> <div id="preview-innings" style="font-size: 12px; font-weight: 600;">-</div></div>
          </div>
          <div id="validation-messages" style="margin-bottom: 8px;"></div>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-primary btn-sm" onclick="uploadMatchData()" id="upload-btn">Upload & Process</button>
            <button class="btn btn-sm" onclick="clearFilePreview()">Cancel</button>
          </div>
        </div>
      </div>
      <div id="upload-status" style="margin-top: 10px;"></div>
    </div>

    <!-- Match Workflow -->
    <div class="card">
      <div class="card-title">🎮 Match Workflow</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <button class="btn btn-primary btn-sm" onclick="startNewGame()">🆕 Start New Match</button>
        <button class="btn btn-sm" onclick="document.getElementById('file-input').click()">📤 Upload Data</button>
      </div>
      <div style="margin-top: 10px; background: var(--bg); border-radius: 8px; padding: 8px; font-size: 11px;">
        <span style="color: var(--muted);">Status:</span> <span style="font-weight: 600;" id="match-status-display">No active match</span>
      </div>
    </div>
```

**Step 2:** Add the JavaScript functions

At the end of the `<script>` tag (before `</script>`), add all the functions from `frontend-upload-integration.js`:

```javascript
// ─── File Upload Handlers ────────────────────────────────────────────────────
let selectedFile = null;
let parsedData = null;

function handleDrop(event) { ... }
function handleFileSelect(event) { ... }
function handleFilePreview() { ... }
function showFilePreview() { ... }
function clearFilePreview() { ... }
async function uploadMatchData() { ... }
function showValidationError(msg) { ... }
function showUploadSuccess(result) { ... }
function showUploadError(msg) { ... }
function startNewGame() { ... }
```

(See `frontend-upload-integration.js` for complete code)

**Step 3:** Complete the backend setup

Follow the steps from `BULK_UPLOAD_INTEGRATION.md`:
- Add Python parser to OCR service
- Add bulk-upload endpoint to backend
- Rebuild containers

**Step 4:** Test

```bash
docker compose build --no-cache
docker compose up -d
# Go to Admin panel, try drag-drop with sample-match-complete.csv
```

---

## Result

Your Admin panel now has **two professional cards** integrated seamlessly:

✅ Compact drag-drop upload zone  
✅ Real-time preview & validation  
✅ Quick "Start New Match" button  
✅ Match workflow tracking  
✅ All matches existing admin controls  

No separate standalone section - everything flows naturally in the existing admin layout.

---

## Files Reference

- `frontend-upload-integration.js` - All JS functions to add
- `sample-match-complete.csv` - Test file
- `BULK_UPLOAD_INTEGRATION.md` - Full backend setup
- `bulk-upload-endpoint.js` - Backend endpoint code
