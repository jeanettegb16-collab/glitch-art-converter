@echo off
cd /d "%~dp0"
echo ================================================
echo   API Node Express - Starting...
echo ================================================
echo.

REM Check if dependencies are installed
if not exist node_modules (
    echo Installing dependencies for the first time...
    echo This may take a minute. Please wait.
    echo.
    call npm install
    echo.
    echo Done installing!
)

REM Check if .env file exists; if not, copy from template
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env >nul
    echo.
    echo [!] IMPORTANT: You need to edit .env and add real API tokens!
    echo     The app will start anyway, but some features won't work.
    echo.
    pause
)

echo Starting the API server...
echo It will be available at: http://localhost:4000
echo.
echo (Press Ctrl+C to stop)
echo.

call npm run dev
pause