DO $$
BEGIN
    -- First add columns as nullable
    ALTER TABLE files
      ADD COLUMN s3_key TEXT,
      ADD COLUMN last_accessed TIMESTAMP WITH TIME ZONE;

    -- Update existing records with corrected s3_key format
    UPDATE files
    SET 
      s3_key = CONCAT(user_id, '/data/', file_name),
      last_accessed = COALESCE(updated_at, created_at);

    -- Now make columns NOT NULL after populating data
    ALTER TABLE files 
      ALTER COLUMN s3_key SET NOT NULL;

    -- Add index for cleanup
    CREATE INDEX idx_files_cleanup ON files (user_id, last_accessed);

    -- Remove old columns
    ALTER TABLE files
      DROP COLUMN IF EXISTS file_url,
      DROP COLUMN IF EXISTS backup_url,
      DROP COLUMN IF EXISTS content_hash,
      DROP COLUMN IF EXISTS s3_url;
END $$;