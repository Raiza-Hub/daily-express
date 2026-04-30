#!/bin/bash

PROJECT_ROOT="/Users/raiza/Desktop/daily-express"

echo "=========================================="
echo "  Daily Express - Full Development Setup"
echo "=========================================="
echo ""

# Phase 1: Infrastructure (Docker)
echo "[1/3] Starting infrastructure..."
docker compose up -d db kafka schema-registry kafka-init-topics

# Wait for Kafka init to complete
echo "Waiting for Kafka init..."
sleep 15

# Phase 2: Backend Services (parallel)
echo "[2/3] Starting backend services..."
(
  cd "$PROJECT_ROOT/services/auth-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/services/driver-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/services/route-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/services/payment-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/services/payout-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/services/notification-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/services/mail-service" && bun run dev
) &
(
  cd "$PROJECT_ROOT/api-gateway" && bun run dev
) &

sleep 5

# Phase 3: Frontend Apps (parallel)
echo "[3/3] Starting frontend apps..."
(
  cd "$PROJECT_ROOT/apps/web" && bun run dev
) &
(
  cd "$PROJECT_ROOT/apps/drivers" && bun run dev
) &

DOCS_AVAILABLE=false
if [ -d "$PROJECT_ROOT/apps/docs" ]; then
  DOCS_AVAILABLE=true
  (
    cd "$PROJECT_ROOT/apps/docs" && bun run dev
  ) &
fi

echo ""
echo "=========================================="
echo "  All services started!"
echo "=========================================="
echo ""
echo "URLs:"
echo "  Frontend:     http://localhost:3000"
echo "  Driver App:  http://localhost:3001"
if [ "$DOCS_AVAILABLE" = true ]; then
  echo "  Docs:        http://localhost:3012"
else
  echo "  Docs:        (not configured in this workspace)"
fi
echo "  API Gateway: http://localhost:8000"
echo ""
echo "Backend Services:"
echo "  auth-service:        http://localhost:5001"
echo "  driver-service:     http://localhost:5002"
echo "  route-service:      http://localhost:5004"
echo "  payment-service:  http://localhost:5005"
echo "  payout-service:   http://localhost:5006"
echo "  notification:    http://localhost:5007"
echo "  mail-service:    http://localhost:3008"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

wait
