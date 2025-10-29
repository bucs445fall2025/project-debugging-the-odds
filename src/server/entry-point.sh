#!/bin/sh
set -e

echo "Waiting for database at $DB_HOST:$DB_PORT..."

# Loop until the port is reachable
until nc -z "$DB_HOST" "$DB_PORT"; do
  echo "Database not ready, retrying..."
  sleep 2
done

echo "Database is ready. Running migrations..."
dotnet ef database update --no-build

echo "Starting application..."
dotnet run --urls=http://0.0.0.0:80
