#!/bin/bash

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker exec supabase-db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "PostgreSQL is ready!"

# Run the migrations
echo "Running database migrations..."
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/001_initial_schema_dev.sql

# Check if RLS should be enabled (production mode)
if [ "$ENABLE_RLS" = "true" ]; then
  echo "Enabling Row Level Security..."
  docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/002_add_rls_policies.sql
  echo "RLS policies applied!"
else
  echo "Skipping RLS (set ENABLE_RLS=true for production)"
fi

echo "Database initialized successfully!"
