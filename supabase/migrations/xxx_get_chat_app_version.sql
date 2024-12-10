CREATE OR REPLACE FUNCTION get_chat_current_app_version(p_chat_id uuid)
RETURNS TABLE (
    version_id uuid,
    app_id uuid,
    code text,
    version_number integer,
    name text,
    description text,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        av.id as version_id,
        a.id as app_id,
        av.code,
        av.version_number,
        av.name,
        av.description,
        av.created_at
    FROM chats c
    JOIN apps a ON c.app_id = a.id
    JOIN app_versions av ON a.current_version_id = av.id
    WHERE c.id = p_chat_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 