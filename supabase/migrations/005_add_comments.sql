-- Create comments table for subfolder comment feeds
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subfolder_id UUID NOT NULL REFERENCES subfolders(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_comments_subfolder_id ON comments(subfolder_id);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for comments
CREATE POLICY "Authenticated users can view all comments" ON comments
    FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create comments" ON comments
    FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE TO authenticated USING (user_id = auth.uid()::text);
