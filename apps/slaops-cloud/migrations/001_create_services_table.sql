-- Migration: Create services table
-- Description: Initial schema for storing service configurations and monitoring data
-- Date: 2025-12-30

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create services table
CREATE TABLE IF NOT EXISTS services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    openapi_doc_url VARCHAR(500),
    openapi_doc_content TEXT,
    availability DECIMAL(5, 2) CHECK (availability >= 0 AND availability <= 100),
    response_time INTEGER CHECK (response_time >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_services_user_id ON services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON services(name);
CREATE INDEX IF NOT EXISTS idx_services_created_at ON services(created_at DESC);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_services_updated_at
    BEFORE UPDATE ON services
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional, for testing)
INSERT INTO services (user_id, name, endpoint, openapi_doc_url, availability, response_time)
VALUES
    ('345abe58-176a-4aea-8215-32f59a4bdead', 'AWS S3', 'https://s3.amazonaws.com', 'https://raw.githubusercontent.com/APIs-guru/openapi-directory/main/APIs/amazonaws.com/s3/2006-03-01/openapi.yaml', 99.99, 45),
    ('47e69e73-fc2f-4b70-ae25-30da001ed6fb', 'GitHub API', 'https://api.github.com', 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json', 99.95, 120),
    ('9f5da599-9fcc-40c6-9526-f54a769ad58e', 'Open-Meteo API', 'https://api.open-meteo.com/v1', 'https://open-meteo.com/docs/openapi.yml', 99.90, 80),
    ('fef384cc-27c8-49f4-b312-0120dbe65a96', 'Stripe API', 'https://api.stripe.com/v1', 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json', 99.99, 95)
ON CONFLICT (id) DO NOTHING;
