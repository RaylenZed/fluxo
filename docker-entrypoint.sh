#!/bin/sh
# ============================================================
# Fluxo — Docker Entrypoint
# ============================================================
set -e

# Ensure data directory exists (in case of bind mount)
mkdir -p "$(dirname "${DB_PATH:-/data/fluxo.db}")"

echo "[entrypoint] Starting Fluxo..."
echo "[entrypoint]   Web UI  → port ${WEB_PORT:-8080}"
echo "[entrypoint]   API     → port ${SERVER_PORT:-8090}"
echo "[entrypoint]   Mihomo  → ${MIHOMO_API_URL:-http://host-gateway:9090}"

# Start Next.js web server in the background
PORT="${WEB_PORT:-8080}" node apps/web/server.js &
WEB_PID=$!
echo "[entrypoint] Next.js started (PID $WEB_PID)"

# Start Fastify API server in the background
node apps/server/dist/index.js &
API_PID=$!
echo "[entrypoint] Fastify started (PID $API_PID)"

# Trap SIGTERM / SIGINT for graceful shutdown
trap 'echo "[entrypoint] Shutting down..."; kill $WEB_PID $API_PID 2>/dev/null; wait' TERM INT

# Wait for either process to exit and propagate its exit code
wait -n
EXIT_CODE=$?

# Clean up remaining background jobs
kill $WEB_PID $API_PID 2>/dev/null || true
wait

exit $EXIT_CODE
