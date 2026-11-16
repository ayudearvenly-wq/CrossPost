-- CrossPost Database Schema & Migrations (Phase 3)
-- Run this script inside your Supabase Project SQL Editor

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CONNECTED ACCOUNTS TABLE
-- Tracks OAuth connections per user for YouTube, Instagram, Facebook
CREATE TABLE IF NOT EXISTS public.connected_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook')),
    account_identifier TEXT, -- Channel ID, Instagram User ID, Page ID
    account_name TEXT,       -- Display name or handle (e.g. @channel)
    connection_status TEXT NOT NULL DEFAULT 'disconnected' CHECK (connection_status IN ('connected', 'disconnected', 'expired')),
    encrypted_access_token TEXT,  -- Kept on server / never exposed directly to client
    encrypted_refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, platform)
);

-- 3. VIDEOS TABLE
-- Stores uploaded video metadata and Supabase storage reference
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    hashtags TEXT DEFAULT '',
    original_filename TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Path inside the 'videos' storage bucket
    file_size_bytes BIGINT,
    duration_seconds NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. PUBLISHING JOBS TABLE
-- Represents a batch distribution event across multiple platforms
CREATE TABLE IF NOT EXISTS public.publishing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    video_id UUID REFERENCES public.videos(id) ON DELETE CASCADE NOT NULL,
    overall_status TEXT NOT NULL DEFAULT 'pending' CHECK (overall_status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. PUBLISHING RESULTS TABLE
-- Detailed per-platform execution result for each publishing job
CREATE TABLE IF NOT EXISTS public.publishing_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES public.publishing_jobs(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'instagram', 'facebook')),
    publishing_status TEXT NOT NULL DEFAULT 'pending' CHECK (publishing_status IN ('pending', 'uploading', 'published', 'failed')),
    platform_video_id TEXT, -- ID returned by YouTube, Instagram or Facebook
    published_url TEXT,     -- Direct link to YouTube Short / Reel
    error_message TEXT,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishing_results ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES (Users can only read and modify their own records)

-- Connected Accounts Policies
CREATE POLICY "Users can view own connected accounts" 
    ON public.connected_accounts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connected accounts" 
    ON public.connected_accounts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connected accounts" 
    ON public.connected_accounts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own connected accounts" 
    ON public.connected_accounts FOR DELETE 
    USING (auth.uid() = user_id);

-- Videos Policies
CREATE POLICY "Users can view own videos" 
    ON public.videos FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own videos" 
    ON public.videos FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own videos" 
    ON public.videos FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own videos" 
    ON public.videos FOR DELETE 
    USING (auth.uid() = user_id);

-- Publishing Jobs Policies
CREATE POLICY "Users can view own publishing jobs" 
    ON public.publishing_jobs FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own publishing jobs" 
    ON public.publishing_jobs FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own publishing jobs" 
    ON public.publishing_jobs FOR UPDATE 
    USING (auth.uid() = user_id);

-- Publishing Results Policies
CREATE POLICY "Users can view own publishing results" 
    ON public.publishing_results FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own publishing results" 
    ON public.publishing_results FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own publishing results" 
    ON public.publishing_results FOR UPDATE 
    USING (auth.uid() = user_id);

-- 8. STORAGE BUCKET CONFIGURATION (Run in SQL or create via dashboard)
-- Insert 'videos' bucket into storage.buckets if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Users can upload their own videos"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'videos' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can view and download their own videos"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'videos' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users can delete their own videos"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'videos' AND 
        auth.uid()::text = (storage.foldername(name))[1]
    );
