@echo off
echo Installing dependencies and preparing project...
echo.
echo [1/3] Preparing Backend...
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate
echo Installing dependencies...
pip install -r requirements.txt -q
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
)
if not exist data (
    echo Creating data directory...
    mkdir data
)
if not exist logs (
    echo Creating logs directory...
    mkdir logs
)
cd ..
echo.
echo [2/3] Preparing Frontend...
cd frontend
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
cd ..
echo.
echo [3/3] Preparing MySQL Exporter...
cd exporters\mysql_exporter
echo Installing dependencies...
pip install -r requirements.txt -q
cd ..\..
echo.
echo Preparation completed successfully!
echo.
echo You can now run:
echo   - start.bat
echo.
echo Press any key to exit...
pause > nul
