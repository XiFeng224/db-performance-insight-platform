@echo off
setlocal enabledelayedexpansion

echo Starting 智值守 demo environment...

echo.
echo [1/3] Preparing Backend...
cd /d "%~dp0backend"

set "VENV_DIR="
if exist ".venv\Scripts\python.exe" set "VENV_DIR=.venv"
if "%VENV_DIR%"=="" if exist "venv\Scripts\python.exe" set "VENV_DIR=venv"
if "%VENV_DIR%"=="" (
    echo Creating backend virtual environment (.venv)...
    python -m venv .venv
    set "VENV_DIR=.venv"
)

if not exist "scripts\seed_demo_data.py" (
    echo [ERROR] backend scripts\seed_demo_data.py not found.
    exit /b 1
)

echo Using venv: %VENV_DIR%
call "%VENV_DIR%\Scripts\activate"
python -m pip install --upgrade pip > nul
if errorlevel 1 (
    echo [ERROR] Failed to upgrade pip.
    exit /b 1
)
pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    exit /b 1
)

echo Seeding demo data...
set PYTHONPATH=.
python scripts\seed_demo_data.py
if errorlevel 1 (
    echo [WARN] Seed failed, continuing with existing data.
)

echo Starting backend server on port 8000...
start "Backend Server" cmd /k "cd /d %cd% && call "%VENV_DIR%\Scripts\activate" && set PYTHONPATH=. && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
cd /d "%~dp0"

echo.
echo [2/3] Preparing Frontend...
cd frontend
if not exist node_modules (
    echo Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        exit /b 1
    )
)

echo Starting frontend dev server on port 5173...
start "Frontend Server" cmd /k "cd /d %cd% && npm run dev"
cd /d "%~dp0"

echo.
echo [3/3] Services started.
echo.
echo Access URLs:
echo   - Frontend: http://localhost:5173
echo   - Backend API: http://localhost:8000
echo   - API Docs: http://localhost:8000/docs
echo.
echo Press any key to stop all services...
pause > nul

echo Stopping services...
taskkill /F /FI "WINDOWTITLE eq Backend Server*" > nul 2>&1
taskkill /F /FI "WINDOWTITLE eq Frontend Server*" > nul 2>&1
echo Done.
endlocal
