-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    ai_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create assets table
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_folder_id ON assets(folder_id);

-- Enable Row Level Security
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for folders
CREATE POLICY "Users can view their own folders" ON folders
    FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can create their own folders" ON folders
    FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can update their own folders" ON folders
    FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own folders" ON folders
    FOR DELETE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RLS Policies for assets (through folder ownership)
CREATE POLICY "Users can view assets in their folders" ON assets
    FOR SELECT USING (
        folder_id IN (SELECT id FROM folders WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    );

CREATE POLICY "Users can create assets in their folders" ON assets
    FOR INSERT WITH CHECK (
        folder_id IN (SELECT id FROM folders WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    );

CREATE POLICY "Users can update assets in their folders" ON assets
    FOR UPDATE USING (
        folder_id IN (SELECT id FROM folders WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    );

CREATE POLICY "Users can delete assets in their folders" ON assets
    FOR DELETE USING (
        folder_id IN (SELECT id FROM folders WHERE user_id = current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Create storage bucket for media files
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload media" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'media');

CREATE POLICY "Anyone can view media" ON storage.objects
    FOR SELECT USING (bucket_id = 'media');

CREATE POLICY "Users can delete their media" ON storage.objects
    FOR DELETE USING (bucket_id = 'media');
