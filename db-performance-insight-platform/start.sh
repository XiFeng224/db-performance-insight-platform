#!/bin/bash

echo "Starting Database Performance Insight Platform..."

echo ""
echo "[1/4] Starting Backend Service..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
fi
echo "Installing dependencies..."
pip install -r requirements.txt -q
echo "Starting backend server on port 8000..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

echo ""
echo "[2/4] Starting MySQL Exporter..."
cd exporters/mysql_exporter
echo "Installing dependencies..."
pip install -r requirements.txt -q
echo "Starting MySQL exporter on port 9104..."
python exporter.py &
EXPORTER_PID=$!
cd ../..

echo ""
echo "[3/4] Starting Frontend Service..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
echo "Starting frontend dev server on port 5173..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "[4/4] All services started!"
echo ""
echo "Access URLs:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - MySQL Exporter: http://localhost:9104"
echo ""
echo "Press Ctrl+C to stop all services..."

# Trap Ctrl+C to kill all background processes
trap "kill $BACKEND_PID $EXPORTER_PID $FRONTEND_PID; exit" INT TERM

wait
