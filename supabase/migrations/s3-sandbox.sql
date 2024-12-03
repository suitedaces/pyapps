DO $$
DECLARE
    s3_bucket TEXT := 'pyapps';
    aws_region TEXT := 'us-east-1';
BEGIN
    -- First add columns as nullable
    ALTER TABLE files
      ADD COLUMN s3_key TEXT,
      ADD COLUMN s3_url TEXT,
      ADD COLUMN last_accessed TIMESTAMP WITH TIME ZONE;

    -- Update existing records with corrected s3_key and s3_url format
    UPDATE files
    SET 
      s3_key = CONCAT(user_id, '/files/', id, '/', file_name),
      s3_url = CONCAT('https://', aws_region, '.console.aws.amazon.com/s3/buckets/', 
                      s3_bucket, '?region=', aws_region, 
                      '&bucketType=general&prefix=', user_id, 
                      '/files/', id, '/', file_name, '&showversions=false'),
      last_accessed = COALESCE(updated_at, created_at);

    -- Now make columns NOT NULL after populating data
    ALTER TABLE files 
      ALTER COLUMN s3_key SET NOT NULL,
      ALTER COLUMN s3_url SET NOT NULL;

    -- Add index for cleanup
    CREATE INDEX idx_files_cleanup ON files (user_id, last_accessed);

END $$;

ALTER TABLE files
DROP COLUMN FILE_URL;

-- Rollback script
/*
ALTER TABLE files
  DROP COLUMN s3_key,
  DROP COLUMN s3_url,
  DROP COLUMN last_accessed,

DROP INDEX IF EXISTS idx_files_cleanup;
DROP INDEX IF EXISTS idx_files_sandbox;

ALTER TABLE files
  ADD COLUMN FILE_URL TEXT;
*/