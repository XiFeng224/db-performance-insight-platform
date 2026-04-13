#!/bin/bash

echo "Installing dependencies and preparing project..."

echo ""
echo "[1/3] Preparing Backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt -q
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cp .env.example .env
fi
if [ ! -d "data" ]; then
    echo "Creating data directory..."
    mkdir -p data
fi
if [ ! -d "logs" ]; then
    echo "Creating logs directory..."
    mkdir -p logs
fi
cd ..

echo ""
echo "[2/3] Preparing Frontend..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
cd ..

echo ""
echo "[3/3] Preparing MySQL Exporter..."
cd exporters/mysql_exporter
echo "Installing dependencies..."
pip install -r requirements.txt -q
cd ../..

echo ""
echo "Preparation completed successfully!"
echo ""
echo "You can now run:"
echo "  - Windows: start.bat"
echo "  - Linux/Mac: ./start.sh"
echo ""
