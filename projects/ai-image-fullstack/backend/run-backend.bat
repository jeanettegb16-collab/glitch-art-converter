@echo off
cd /d "%~dp0"
echo ================================================
echo   AI Image Fullstack - BACKEND
echo ================================================
echo.

if not exist node_modules (
    echo Installing dependencies for the first time...
    call npm install
    echo.
)

if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env >nul 2>nul
    echo.
    echo [!] IMPORTANT: You need to edit .env and add your Hugging Face API token!
    echo     Without it, AI image generation will NOT work.
    echo     The server will start but responses will fail.
    echo.
    pause
)

echo Starting the backend server...
echo It will be available at: http://localhost:4000
echo.
echo (Press Ctrl+C to stop)
echo.

call npm run dev
pause