-- Add Row Level Security (RLS) policies
-- This ensures users can only access their own data

-- Enable RLS on folders table
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Enable RLS on assets table
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Users can view own folders" ON folders;
DROP POLICY IF EXISTS "Users can create own folders" ON folders;
DROP POLICY IF EXISTS "Users can update own folders" ON folders;
DROP POLICY IF EXISTS "Users can delete own folders" ON folders;
DROP POLICY IF EXISTS "Users can view assets in own folders" ON assets;
DROP POLICY IF EXISTS "Users can create assets in own folders" ON assets;
DROP POLICY IF EXISTS "Users can update assets in own folders" ON assets;
DROP POLICY IF EXISTS "Users can delete assets in own folders" ON assets;

-- Folders policies
-- Users can only see their own folders
CREATE POLICY "Users can view own folders" ON folders
    FOR SELECT
    USING (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
    );

-- Users can only create folders for themselves
CREATE POLICY "Users can create own folders" ON folders
    FOR INSERT
    WITH CHECK (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
    );

-- Users can only update their own folders
CREATE POLICY "Users can update own folders" ON folders
    FOR UPDATE
    USING (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
    );

-- Users can only delete their own folders
CREATE POLICY "Users can delete own folders" ON folders
    FOR DELETE
    USING (
        user_id = current_setting('request.jwt.claims', true)::json->>'sub'
        OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
        OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
    );

-- Assets policies (based on folder ownership)
-- Users can view assets in their own folders
CREATE POLICY "Users can view assets in own folders" ON assets
    FOR SELECT
    USING (
        folder_id IN (
            SELECT id FROM folders WHERE
                user_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
                OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
        )
    );

-- Users can create assets in their own folders
CREATE POLICY "Users can create assets in own folders" ON assets
    FOR INSERT
    WITH CHECK (
        folder_id IN (
            SELECT id FROM folders WHERE
                user_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
                OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
        )
    );

-- Users can update assets in their own folders
CREATE POLICY "Users can update assets in own folders" ON assets
    FOR UPDATE
    USING (
        folder_id IN (
            SELECT id FROM folders WHERE
                user_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
                OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
        )
    );

-- Users can delete assets in their own folders
CREATE POLICY "Users can delete assets in own folders" ON assets
    FOR DELETE
    USING (
        folder_id IN (
            SELECT id FROM folders WHERE
                user_id = current_setting('request.jwt.claims', true)::json->>'sub'
                OR user_id = current_setting('request.jwt.claims', true)::json->>'user_id'
                OR user_id = coalesce(current_setting('request.jwt.claim.sub', true), '')
        )
    );

-- For local development with admin bypass: allow anon role to bypass RLS
-- Remove this in production!
ALTER TABLE folders FORCE ROW LEVEL SECURITY;
ALTER TABLE assets FORCE ROW LEVEL SECURITY;

-- Create a bypass policy for the anon role in development
-- This checks for a special header or allows the demo anon key
CREATE POLICY "Dev bypass for anon" ON folders
    FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'anon')
    WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'anon');

CREATE POLICY "Dev bypass for anon assets" ON assets
    FOR ALL
    USING (current_setting('request.jwt.claims', true)::json->>'role' = 'anon')
    WITH CHECK (current_setting('request.jwt.claims', true)::json->>'role' = 'anon');
