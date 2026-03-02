-- Create subfolders table
CREATE TABLE IF NOT EXISTS subfolders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add subfolder_id to assets (nullable for migration)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS subfolder_id UUID REFERENCES subfolders(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subfolders_folder_id ON subfolders(folder_id);
CREATE INDEX IF NOT EXISTS idx_assets_subfolder_id ON assets(subfolder_id);

-- Enable RLS on subfolders
ALTER TABLE subfolders ENABLE ROW LEVEL SECURITY;

-- RLS policies for subfolders
CREATE POLICY "Authenticated users can view all subfolders" ON subfolders
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create subfolders" ON subfolders
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update all subfolders" ON subfolders
    FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete all subfolders" ON subfolders
    FOR DELETE TO authenticated USING (true);

-- Migration: For each folder with assets, create a default "Assets" subfolder and move assets into it
DO $$
DECLARE
    folder_record RECORD;
    new_subfolder_id UUID;
BEGIN
    -- Find all folders that have assets without a subfolder_id
    FOR folder_record IN
        SELECT DISTINCT f.id as folder_id
        FROM folders f
        INNER JOIN assets a ON a.folder_id = f.id
        WHERE a.subfolder_id IS NULL
    LOOP
        -- Create a default "Assets" subfolder for this folder
        INSERT INTO subfolders (folder_id, name, created_at, updated_at)
        VALUES (folder_record.folder_id, 'Assets', NOW(), NOW())
        RETURNING id INTO new_subfolder_id;

        -- Move all assets from this folder into the new subfolder
        UPDATE assets
        SET subfolder_id = new_subfolder_id
        WHERE folder_id = folder_record.folder_id
        AND subfolder_id IS NULL;
    END LOOP;
END $$;
