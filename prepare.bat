@echo off
setlocal

echo Preparing 智值守 demo environment...
echo.

echo [1/3] Preparing Backend...
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment (.venv)...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create backend virtual environment.
        exit /b 1
    )
)
call ".venv\Scripts\activate"
if not exist ".env" (
    echo Creating .env file from .env.example...
    copy /Y ".env.example" ".env" > nul
)
if not exist "data" mkdir data
if not exist "logs" mkdir logs

echo Installing backend dependencies...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    exit /b 1
)

if exist "scripts\seed_demo_data.py" (
    echo Seeding demo data...
    set PYTHONPATH=.
    python scripts\seed_demo_data.py
)
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
cd /d "%~dp0"

echo.
echo [3/3] Preparing MySQL Exporter...
if exist "exporters\mysql_exporter\requirements.txt" (
    cd exporters\mysql_exporter
    echo Installing exporter dependencies...
    pip install -r requirements.txt -q
    if errorlevel 1 (
        echo [WARN] MySQL exporter dependency install failed.
    )
    cd /d "%~dp0"
)

echo.
echo Preparation completed successfully!
echo.
echo You can now run:
echo   - Windows: start.bat
echo   - Linux/Mac: ./start.sh
endlocal
