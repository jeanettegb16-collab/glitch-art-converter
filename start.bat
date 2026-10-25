@echo off
REM Start both Glitch-Art services (frontend Vite + API Express)

echo ==========================================
echo  GLITCH-ART FULL-STACK LAUNCHER
echo ==========================================

REM Start Vite dev server in a new window
echo [1/2] Starting frontend (vite dev on port 5173)...
start "VITE DEV" cmd /k "cd /d %~dp0 && npx vite --port 5173"

REM Start API server in a new window
echo [2/2] Starting API (tsx watch on port 3000)...
start "API SERVER" cmd /k "cd /d %~dp0\projects\api-node-express && npx tsx watch src/index.ts"

timeout /t 2 >nul
echo.
echo ==========================================
echo  Both services launching in new windows!
echo.
echo  Frontend:  http://localhost:5173/glitch-art-converter/
echo  API:       http://localhost:3000/health
echo ==========================================
pause
