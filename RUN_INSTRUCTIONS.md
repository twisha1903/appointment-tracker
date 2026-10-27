# Step-by-Step Guide: How to Run CareTrack Locally
### The Hospital Patient & Appointment Tracker (Windows PowerShell / CMD Guide)

Follow this simple, step-by-step guide to run both the Python FastAPI backend and the React frontend on your computer.

---

## 1. System Requirements & Quick Check

Make sure you have Python and Node.js installed. Open **PowerShell** or **Command Prompt** and check:

```powershell
python --version    # Should be Python 3.10, 3.11, or 3.12+
node -v             # Should be Node.js v18, v20, or v22+
npm -v              # Should be npm v9 or v10+
```

---

## 2. One-Time Setup (First Time Only)

If you haven't installed dependencies yet, run these commands:

### A. Set Up Backend Virtual Environment
Open PowerShell in the project root folder: `c:\Users\twipa\OneDrive\Desktop\ads`

```powershell
# 1. Create a Python virtual environment (if .venv doesn't already exist)
python -m venv .venv

# 2. Activate the virtual environment
.\.venv\Scripts\Activate.ps1
# (Note: If using CMD instead of PowerShell, run: .\.venv\Scripts\activate.bat)

# 3. Install required Python packages
python -m pip install --upgrade pip
pip install -r backend\requirements.txt
```

> **Note on PowerShell Script Security:**  
> If PowerShell gives an error saying *"running scripts is disabled on this system"*, run this once:  
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` and try activating again.

---

### B. Install Frontend Packages
In the same project folder:

```powershell
cd frontend
npm install
cd ..
```

---

## 3. How to Run the Project (Daily Workflow)

Running the application requires **two terminal windows**:
- **Terminal 1:** Runs the Python FastAPI Backend Server (`http://localhost:8000`)
- **Terminal 2:** Runs the React + Vite Frontend Server (`http://localhost:5173`)

---

### Terminal 1: Start the Backend Server

1. Open a new terminal window in `c:\Users\twipa\OneDrive\Desktop\ads`.
2. Activate the virtual environment and start the server:

```powershell
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```

You should see output ending with:
```
INFO:     Started server process [...]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**Helpful Backend URLs:**
- **Live Health Status:** [http://localhost:8000/api/health](http://localhost:8000/api/health)
- **Interactive Swagger API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live Event Stream:** [http://localhost:8000/api/events](http://localhost:8000/api/events)

---

### Terminal 2: Start the Frontend Application

1. Open a **second terminal window** in `c:\Users\twipa\OneDrive\Desktop\ads\frontend`.
2. Start the Vite development server:

```powershell
npm run dev
```

You should see output like:
```
  VITE v5.4.21  ready in 450 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

3. Open your browser (Google Chrome or Microsoft Edge) and navigate to:  
   👉 **`http://localhost:5173`**

---

## 4. How to Verify Everything is Working

When `http://localhost:5173` loads in your browser, check these four visual cues:
1. **Live Connection Badge:** Look at the top right of the screen. You should see a green **"Live SSE Connected"** badge.
2. **Dashboard Overview:** You should see **9 Registered Patients** and **7 Today's Appointments** pre-loaded.
3. **Live ADS Telemetry Card:** On the bottom right of the dashboard, you should see real-time dials for:
   - *Custom Hash Table:* Size = 9, Capacity = 16, Load Factor ~0.562
   - *Standard Prefix Trie:* Total Nodes ~147, Terminal Words = 9
   - *Augmented AVL Tree:* Active Appointments = 7, Tree Height ~3
   - *KMP Pattern Engine:* Active
4. **Try Trie Autocomplete:** Click the search bar at the top and type `"Aarav"`. It will immediately show both *Aarav Sharma* records (`PT-1001` and `PT-1002`).

---

## 5. How to Run the Automated Tests

To run the automated test suite and prove to yourself or your evaluator that all 4 data structures and APIs pass:

### Option A: Run Pytest Test Suite (53 Automated Tests)
In your backend terminal (with `.venv` activated):

```powershell
cd c:\Users\twipa\OneDrive\Desktop\ads\backend
..\.venv\Scripts\python.exe -m pytest -v
```

Expected output:
```
======================= 53 passed, 1 warning in 18s =======================
```

---

### Option B: Run the Live Server Socket Verification Script
This script launches Uvicorn in the background, sends real HTTP requests to the 5 primary endpoints, prints the live responses, and closes cleanly:

```powershell
cd c:\Users\twipa\OneDrive\Desktop\ads\backend
..\.venv\Scripts\python.exe verify_live_api.py
```

Expected output:
```
All 5 live endpoints verified successfully against active Uvicorn server!
Uvicorn test process terminated cleanly.
```

---

### Option C: Build Frontend Production Bundle
To verify that all TypeScript types and JSX components bundle cleanly:

```powershell
cd c:\Users\twipa\OneDrive\Desktop\ads\frontend
npm run build
```

Expected output:
```
✓ 1478 modules transformed.
dist/index.html                   0.89 kB
dist/assets/index-DzhEu_Lq.css   35.52 kB
dist/assets/index-gs3uFvnk.js   285.71 kB
✓ built in 21s
```

---

## 6. How to Reset the Demo Dataset

If you test creating, deleting, or rescheduling appointments and want to reset the database back to its clean initial state:
1. In the web interface, click the red **"Reset Demo Dataset"** button (found on the Overview dashboard or Architecture tab) and confirm the prompt.
2. **Or via terminal command:**
   ```powershell
   curl -X POST http://localhost:8000/api/system/reset-demo
   ```
This resets the SQLite database to the 9 default fictional patients and 7 appointments, and re-indexes all in-memory data structures automatically.

---

## 7. Troubleshooting Common Issues

### Issue 1: Port 8000 is already in use
- **Cause:** Another program or an orphaned Python process is holding port 8000.
- **Solution:** In PowerShell, find and stop the process:
  ```powershell
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
  ```
  Then run `uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload` again.

### Issue 2: Frontend shows "Offline" badge (Red)
- **Cause:** The backend server in Terminal 1 is not running or crashed.
- **Solution:** Check Terminal 1 to ensure Uvicorn is running on `http://127.0.0.1:8000`.

### Issue 3: Virtual environment activation script is blocked
- **Cause:** Windows PowerShell security policy blocks `.ps1` execution.
- **Solution:** Open PowerShell as Administrator and run:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
  Or simply use standard Windows Command Prompt (`cmd.exe`) and run `.\.venv\Scripts\activate.bat`.
