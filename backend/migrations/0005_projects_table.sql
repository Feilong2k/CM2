-- Drop the projects table if it exists, and cascade to drop any dependent objects (like foreign keys)
DROP TABLE IF EXISTS projects CASCADE;

-- Create projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert the default project P1
INSERT INTO projects (external_id, name) VALUES ('P1', 'Project 1')
ON CONFLICT (external_id) DO NOTHING;
