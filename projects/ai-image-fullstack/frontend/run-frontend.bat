@echo off
cd /d "%~dp0"
echo ================================================
echo   AI Image Fullstack - FRONTEND
echo ================================================
echo.

if not exist node_modules (
    echo Installing dependencies for the first time...
    call npm install
    echo.
)

echo Starting the frontend website...
echo It will open automatically in your browser at: http://localhost:5173
echo.
echo (Press Ctrl+C to stop)
echo.

call npm run dev -- --open
pause