-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create some tables
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    geom GEOGRAPHY(POINT, 4326)
);

-- Insert sample data
INSERT INTO locations (name, geom)
VALUES ('Test Location', ST_GeogFromText('SRID=4326;POINT(-122.431297 37.773972)'));

