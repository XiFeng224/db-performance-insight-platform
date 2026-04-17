#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PID=""
FRONTEND_PID=""
EXPORTER_PID=""

cleanup() {
  if [ -n "$BACKEND_PID" ]; then kill "$BACKEND_PID" 2>/dev/null || true; fi
  if [ -n "$FRONTEND_PID" ]; then kill "$FRONTEND_PID" 2>/dev/null || true; fi
  if [ -n "$EXPORTER_PID" ]; then kill "$EXPORTER_PID" 2>/dev/null || true; fi
}

trap cleanup INT TERM EXIT

echo "Starting 智值守 demo environment..."

echo ""
echo "[1/3] Starting Backend Service..."
cd "$ROOT_DIR/backend"
if [ ! -d ".venv" ] && [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi
VENV_DIR=".venv"
[ -d "venv" ] && VENV_DIR="venv"
source "$VENV_DIR/bin/activate"
if [ ! -f ".env" ]; then
  echo "Creating .env file..."
  cp .env.example .env
fi
echo "Installing dependencies..."
pip install -r requirements.txt -q
if [ -f "scripts/seed_demo_data.py" ]; then
  echo "Seeding demo data..."
  PYTHONPATH=. python scripts/seed_demo_data.py || echo "[WARN] Seed failed, continuing with existing data."
fi
echo "Starting backend server on port 8000..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo "[2/3] Starting Frontend Service..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Starting frontend dev server on port 5173..."
npm run dev &
FRONTEND_PID=$!
cd "$ROOT_DIR"

echo ""
echo "[3/3] Starting MySQL Exporter..."
if [ -d "$ROOT_DIR/exporters/mysql_exporter" ]; then
  cd "$ROOT_DIR/exporters/mysql_exporter"
  echo "Installing dependencies..."
  pip install -r requirements.txt -q || echo "[WARN] MySQL exporter dependency install failed."
  if [ -f "exporter.py" ]; then
    echo "Starting MySQL exporter on port 9104..."
    python exporter.py &
    EXPORTER_PID=$!
  fi
  cd "$ROOT_DIR"
fi

echo ""
echo "All services started!"
echo ""
echo "Access URLs:"
echo "  - Frontend: http://localhost:5173"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - MySQL Exporter: http://localhost:9104"
echo ""
echo "Press Ctrl+C to stop all services..."

wait
