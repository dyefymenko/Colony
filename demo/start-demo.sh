#!/bin/bash
set -e

echo "============================================"
echo "  AgentHire — Autonomous Agent Marketplace  "
echo "============================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# Check for .env
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in your credentials."
  exit 1
fi

# Check for state.json
if [ ! -f state.json ]; then
  echo "ERROR: state.json not found. Run bootstrap first:"
  echo "  cd server && npm run bootstrap"
  exit 1
fi

echo "[1/4] Starting mock x402 services..."
cd mock-services
npx tsx proxy-api.ts &
npx tsx llm-api.ts &
npx tsx data-feed.ts &
cd "$PROJECT_DIR"

echo "[2/4] Starting AgentHire server..."
cd server
npx tsx src/index.ts &
cd "$PROJECT_DIR"

# Wait for server to be ready
echo "  Waiting for server..."
for i in $(seq 1 15); do
  if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    break
  fi
  perl -e 'select(undef, undef, undef, 1)'
done

echo "[3/4] Seeding agents and jobs..."
npx tsx demo/seed-agents.ts

echo "[4/4] Starting dashboard..."
cd dashboard
npx vite &
cd "$PROJECT_DIR"

echo ""
echo "============================================"
echo "  All systems running!                      "
echo "                                            "
echo "  Server:    http://localhost:3001           "
echo "  Dashboard: http://localhost:5173           "
echo "  Events:    http://localhost:3001/events    "
echo "                                            "
echo "  Mock x402 services:                       "
echo "    Proxy:     http://localhost:3010         "
echo "    LLM:       http://localhost:3011         "
echo "    Data Feed: http://localhost:3012         "
echo "                                            "
echo "  Press Ctrl+C to stop all services         "
echo "============================================"

# Wait for all background processes
wait
