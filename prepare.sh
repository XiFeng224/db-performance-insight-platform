#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Preparing 智值守 demo environment..."

echo ""
echo "[1/3] Preparing Backend..."
cd "$ROOT_DIR/backend"
if [ ! -d ".venv" ] && [ ! -d "venv" ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi
VENV_DIR=".venv"
[ -d "venv" ] && VENV_DIR="venv"
source "$VENV_DIR/bin/activate"
echo "Installing dependencies..."
pip install -r requirements.txt -q
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  echo "Creating .env file..."
  cp .env.example .env
fi
mkdir -p data logs
if [ -f "scripts/seed_demo_data.py" ]; then
  echo "Seeding demo data..."
  PYTHONPATH=. python scripts/seed_demo_data.py || echo "[WARN] Seed failed, continuing."
fi

echo ""
echo "[2/3] Preparing Frontend..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "[3/3] Preparing MySQL Exporter..."
if [ -d "$ROOT_DIR/exporters/mysql_exporter" ]; then
  cd "$ROOT_DIR/exporters/mysql_exporter"
  echo "Installing dependencies..."
  pip install -r requirements.txt -q || echo "[WARN] MySQL exporter dependency install failed."
fi

echo ""
echo "Preparation completed successfully!"
echo ""
echo "You can now run:"
echo "  - Windows: start.bat"
echo "  - Linux/Mac: ./start.sh"
