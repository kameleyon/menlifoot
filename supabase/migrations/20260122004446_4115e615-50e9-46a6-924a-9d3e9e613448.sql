-- Create storage bucket for article images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles', 'articles', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to article images
CREATE POLICY "Public Access for article images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'articles');

-- Allow authenticated users (admins/editors) to upload article images
CREATE POLICY "Authenticated users can upload article images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'articles' AND auth.role() = 'authenticated');

-- Allow authenticated users to update their uploaded images
CREATE POLICY "Authenticated users can update article images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'articles' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete article images
CREATE POLICY "Authenticated users can delete article images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'articles' AND auth.role() = 'authenticated');