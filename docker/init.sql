-- Initial database setup for CopeCompanion
-- This file runs when the PostgreSQL container starts for the first time

-- Create the database (if not exists)
-- Note: This is handled by POSTGRES_DB environment variable in docker-compose.yml

-- Set up any initial data or configurations here
-- For now, we'll let Prisma handle the schema creation via migrations