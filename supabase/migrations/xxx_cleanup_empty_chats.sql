-- Drop existing function
DROP FUNCTION IF EXISTS cleanup_empty_chats();
DROP FUNCTION IF EXISTS cleanup_empty_chats(integer);

-- Create new function with fixed column references
CREATE OR REPLACE FUNCTION cleanup_empty_chats()
RETURNS TABLE (
    chat_id UUID,
    files_removed INT,
    deleted_at TIMESTAMPTZ
) SECURITY DEFINER AS $$
DECLARE
    v_files_removed INT;
BEGIN
    -- First delete chat_files for empty chats
    WITH deleted_files AS (
        DELETE FROM chat_files
        WHERE chat_id IN (
            SELECT c.id
            FROM chats c
            LEFT JOIN messages m ON c.id = m.chat_id
            WHERE m.id IS NULL
        )
        RETURNING chat_files.chat_id  -- Explicitly reference the table
    )
    SELECT COUNT(*) INTO v_files_removed FROM deleted_files;

    -- Then delete and return info about the empty chats
    RETURN QUERY
    WITH deleted_chats AS (
        DELETE FROM chats
        WHERE id IN (
            SELECT c.id
            FROM chats c
            LEFT JOIN messages m ON c.id = m.chat_id
            WHERE m.id IS NULL
        )
        RETURNING chats.id  -- Explicitly reference the table
    )
    SELECT 
        dc.id,
        v_files_removed,
        NOW()
    FROM deleted_chats dc;
END;
$$ LANGUAGE plpgsql; 