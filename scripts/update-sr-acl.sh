#!/bin/bash
# Script to update Schema Registry ACLs for API key
# Usage: source this file or run after 'confluent login'

export PATH="$HOME/.local/bin:$PATH"

echo "Checking Confluent CLI login status..."
confluent auth describe 2>&1 || {
    echo "Please login first: confluent login"
    exit 1
}

echo "Getting environment ID..."
ENV_ID=$(confluent environment list -o json | jq -r '.[0].id')
echo "Environment ID: $ENV_ID"

echo "Getting Schema Registry cluster ID..."
SR_CLUSTER_ID=$(confluent schema-registry cluster describe -o json | jq -r '.id')
echo "Schema Registry Cluster ID: $SR_CLUSTER_ID"

echo "Assigning ResourceOwner role for all subjects to API key..."
confluent iam rbac role-binding create \
  --principal User:7ORTGD64XNWS4PGW \
  --role ResourceOwner \
  --resource Subject:* \
  --environment $ENV_ID \
  --schema-registry-cluster $SR_CLUSTER_ID

echo "Done! Now run: bun run kafka:register-schemas"
