#!/bin/sh
set -e

echo "Running migrations..."
npm run db:migrate

echo "Seeding database..."
npm run db:seed

echo "Starting MCP server..."
exec npm run dev:http
