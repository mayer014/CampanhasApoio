UPDATE storage.buckets
SET file_size_limit = 15728640, -- 15 MB
    allowed_mime_types = ARRAY[
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/svg+xml',
      'image/gif',
      'image/heic',
      'image/heif'
    ]
WHERE id = 'template-layers';