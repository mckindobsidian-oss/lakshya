-- Supabase Database Setup Script for Lakshya's Website
-- Copy and paste this entirely into the Supabase SQL Editor and run it.

-- 1. Create Tables

-- Posts Table
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    image_url TEXT,
    file_url TEXT,
    slug TEXT UNIQUE,
    category TEXT,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    tracking_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Subscribers Table
CREATE TABLE IF NOT EXISTS public.subscribers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    tracking_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages Table (Contact Form)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    tracking_id TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Page Views Table
CREATE TABLE IF NOT EXISTS public.page_views (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path TEXT NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    user_email TEXT,
    tracking_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Projects Table (Case Studies)
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
    description TEXT,
    link TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Visitors View (For Admin Dashboard Unique Visitors Count)
CREATE OR REPLACE VIEW public.visitors AS
SELECT DISTINCT tracking_id
FROM public.page_views
WHERE tracking_id IS NOT NULL;


-- 2. Create Functions and Triggers

-- Function to increment post views safely
CREATE OR REPLACE FUNCTION increment_post_view(p_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.posts
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_id;
END;
$$;

-- Function to automatically update the 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for posts updated_at
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- 3. Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Posts: Anyone can read, only authenticated can manage
CREATE POLICY "Public can view posts" ON public.posts FOR SELECT USING (true);
CREATE POLICY "Auth can manage posts" ON public.posts FOR ALL USING (auth.role() = 'authenticated');

-- Comments: Anyone can read, authenticated can insert, auth can manage
CREATE POLICY "Public can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Auth can insert comments" ON public.comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth can manage comments" ON public.comments FOR ALL USING (auth.role() = 'authenticated');

-- Subscribers: Anyone can insert (newsletter signup), only authenticated can view/manage
CREATE POLICY "Public can insert subscribers" ON public.subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can manage subscribers" ON public.subscribers FOR ALL USING (auth.role() = 'authenticated');

-- Messages: Anyone can insert (contact form), only authenticated can view/manage
CREATE POLICY "Public can insert messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can manage messages" ON public.messages FOR ALL USING (auth.role() = 'authenticated');

-- Page Views: Anyone can insert (tracking), only authenticated can view/manage
CREATE POLICY "Public can insert page views" ON public.page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can manage page views" ON public.page_views FOR ALL USING (auth.role() = 'authenticated');

-- Projects: Anyone can read, only authenticated can manage
CREATE POLICY "Public can view projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Auth can manage projects" ON public.projects FOR ALL USING (auth.role() = 'authenticated');


-- 4. Storage Setup (Assets and Blog Images)

-- Insert buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage objects (Already enabled by default in Supabase)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage Policies
-- Note: 'storage.objects' policies might already exist depending on the Supabase project defaults, 
-- so you may need to drop existing ones or adjust these names if they conflict.

CREATE POLICY "Public read access for assets" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('assets', 'blog-images'));

CREATE POLICY "Auth insert access for assets" 
ON storage.objects FOR INSERT 
WITH CHECK (auth.role() = 'authenticated' AND bucket_id IN ('assets', 'blog-images'));

CREATE POLICY "Auth delete access for assets" 
ON storage.objects FOR DELETE 
USING (auth.role() = 'authenticated' AND bucket_id IN ('assets', 'blog-images'));


-- ============================================================================
-- EXAMPLES: How to add and remove blogs via SQL
-- ============================================================================

/*
-- 1. Example: Insert a new blog post
INSERT INTO public.posts (title, excerpt, content, slug, views) 
VALUES (
  'My First Dynamic Blog Post',
  'This is a short excerpt for the post.',
  '<p>This is the full HTML content of the post. You can write your blog content here.</p>',
  'my-first-dynamic-blog-post',
  0
);

-- 2. Example: Insert another post with an image
INSERT INTO public.posts (title, excerpt, content, slug, image_url) 
VALUES (
  'Another Great Insight',
  'Exploring the depths of chess and technology.',
  '<p>Content goes here...</p>',
  'another-great-insight',
  'https://lakshyagupta.qzz.io/assets/images/lakshya.png'
);

-- 3. Example: Delete a specific blog post by slug
DELETE FROM public.posts WHERE slug = 'my-first-dynamic-blog-post';

-- 4. Example: Delete all blog posts (DANGER!)
-- DELETE FROM public.posts;
*/
