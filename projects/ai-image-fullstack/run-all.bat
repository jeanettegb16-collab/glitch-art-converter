@echo off
cd /d "%~dp0"
echo ================================================
echo   AI Image Fullstack - Starting BOTH parts...
echo ================================================
echo.

REM --- BACKEND ---
echo [1/2] Starting the BACKEND (the AI engine)...
cd backend

if not exist node_modules (
    echo      Installing backend dependencies...
    call npm install >nul 2>&1
)

if not exist .env (
    echo      Creating .env file from template...    
    copy .env.example .env >nul 2>nul
)

REM Start backend in a NEW window so it doesn't block
start "AI Backend (API Server)" cmd /c "cd /d "%~dp0\backend" && echo Backend running at http://localhost:4000 && call npm run dev"

REM Give the backend a head start
timeout /t 3 /nobreak >nul

REM --- FRONTEND ---
echo [2/2] Starting the FRONTEND (the website you see)...
cd ..\frontend

if not exist node_modules (
    echo      Installing frontend dependencies...
    call npm install >nul 2>&1
)

REM Open frontend in a new window and auto-launch browser
start "AI Frontend (Web App)" cmd /c "cd /d "%~dp0\frontend" && call npm run dev -- --open"

echo.
echo ================================================
echo   Both parts are launching in separate windows!
echo   Wait ~10 seconds for everything to load.
echo ================================================
echo.
echo   FRONTEND (what you use):  http://localhost:5173
echo   BACKEND  (the engine):    http://localhost:4000
echo.
pause