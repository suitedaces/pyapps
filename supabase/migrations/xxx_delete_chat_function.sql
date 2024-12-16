-- supabase/migrations/xxx_delete_chat_function.sql
CREATE OR REPLACE FUNCTION delete_chat_and_related(
    p_chat_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_app_id UUID;
    v_deleted_count JSONB;
BEGIN
    -- Verify chat ownership
    IF NOT EXISTS (
        SELECT 1 FROM chats 
        WHERE id = p_chat_id AND user_id = p_user_id
    ) THEN
        RAISE EXCEPTION 'Chat not found or unauthorized';
    END IF;

    -- Get the app_id
    SELECT app_id INTO v_app_id
    FROM chats
    WHERE id = p_chat_id;

    -- Initialize deletion statistics
    v_deleted_count := jsonb_build_object(
        'chat_files_associations', 0,
        'messages', 0,
        'app_versions', 0,
        'apps', 0,
        'chat', 0
    );

    -- 1. Delete messages
    WITH deleted_messages AS (
        DELETE FROM messages
        WHERE chat_id = p_chat_id
        RETURNING id
    )
    SELECT jsonb_set(
        v_deleted_count,
        '{messages}',
        to_jsonb(COUNT(*))
    ) INTO v_deleted_count
    FROM deleted_messages;

    -- 2. Delete chat_files associations (but keep the files)
    WITH deleted_chat_files AS (
        DELETE FROM chat_files
        WHERE chat_id = p_chat_id
        RETURNING id
    )
    SELECT jsonb_set(
        v_deleted_count,
        '{chat_files_associations}',
        to_jsonb(COUNT(*))
    ) INTO v_deleted_count
    FROM deleted_chat_files;

    -- 3. If there's an associated app, handle app-related deletions
    IF v_app_id IS NOT NULL THEN
        -- Delete app versions
        WITH deleted_versions AS (
            DELETE FROM app_versions
            WHERE app_id = v_app_id
            RETURNING id
        )
        SELECT jsonb_set(
            v_deleted_count,
            '{app_versions}',
            to_jsonb(COUNT(*))
        ) INTO v_deleted_count
        FROM deleted_versions;

        -- Delete the app
        WITH deleted_app AS (
            DELETE FROM apps
            WHERE id = v_app_id AND user_id = p_user_id
            RETURNING id
        )
        SELECT jsonb_set(
            v_deleted_count,
            '{apps}',
            to_jsonb(COUNT(*))
        ) INTO v_deleted_count
        FROM deleted_app;
    END IF;

    -- 4. Finally delete the chat itself
    WITH deleted_chat AS (
        DELETE FROM chats
        WHERE id = p_chat_id AND user_id = p_user_id
        RETURNING id
    )
    SELECT jsonb_set(
        v_deleted_count,
        '{chat}',
        to_jsonb(COUNT(*))
    ) INTO v_deleted_count
    FROM deleted_chat;

    RETURN v_deleted_count;

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to delete chat and related data: %', SQLERRM;
END;
$$;

-- Add necessary permissions
GRANT EXECUTE ON FUNCTION delete_chat_and_related TO authenticated;