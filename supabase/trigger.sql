/*
This trigger manages Streamlit app versioning based on message tool results:

1. When to trigger:
   - On new message with streamlit tool results
   - On message update where tool results change
   - Only if the streamlit code actually changed

2. What it does:
   - First time: Creates new app and version 1
   - Subsequent times: Creates new version only if code changed
   - Updates chat -> app relationship
   - Sets current_version_id on the app

3. Requirements:
   - Message must have tool_results
   - Tool must be "streamlitTool"
   - Results must contain code/name/description
*/
-- Create function to handle the trigger
CREATE OR REPLACE FUNCTION handle_streamlit_message()
RETURNS TRIGGER AS $$
DECLARE
    _app_id uuid;
    _version_number integer;
    _tool_result json;
    _app_name text;
    _app_description text;
    _code text;
    _current_code text;
BEGIN
    -- For UPDATE: proceed if tool_results changes (either from NULL or different value)
    -- For INSERT: proceed if tool_results is not NULL
    IF (TG_OP = 'UPDATE' AND NEW.tool_results IS NOT NULL AND 
        (OLD.tool_results IS NULL OR OLD.tool_results::text != NEW.tool_results::text)) OR
       (TG_OP = 'INSERT' AND NEW.tool_results IS NOT NULL) THEN
        
        -- Check if it contains streamlitTool
        IF jsonb_array_length(NEW.tool_results) > 0 AND
           NEW.tool_results->0->>'toolName' = 'streamlitTool' THEN

            -- Extract the relevant data from tool_results
            _tool_result := NEW.tool_results->0->'result';
            _app_name := _tool_result->>'appName';
            _app_description := _tool_result->>'appDescription';
            _code := _tool_result->>'code';

            -- Check if an app already exists for this chat
            SELECT app_id INTO _app_id
            FROM chats
            WHERE id = NEW.chat_id;

            IF _app_id IS NULL THEN
                -- Create new app if none exists
                INSERT INTO apps (
                    id,
                    user_id,
                    name,
                    description,
                    is_public,
                    created_at,
                    updated_at,
                    created_by
                ) VALUES (
                    gen_random_uuid(),
                    NEW.user_id,
                    _app_name,
                    _app_description,
                    false,
                    NOW(),
                    NOW(),
                    NEW.user_id
                ) RETURNING id INTO _app_id;

                -- Update the chat with the new app_id
                UPDATE chats
                SET app_id = _app_id
                WHERE id = NEW.chat_id;

                -- Set version number to 1 for new app
                _version_number := 1;
            ELSE
                -- Get the current code
                SELECT code INTO _current_code
                FROM app_versions av
                JOIN apps a ON a.current_version_id = av.id
                WHERE a.id = _app_id;

                -- Only create new version if code has changed
                IF _current_code IS NULL OR _current_code != _code THEN
                    -- Get the next version number for existing app
                    SELECT COALESCE(MAX(version_number), 0) + 1
                    INTO _version_number
                    FROM app_versions
                    WHERE app_id = _app_id;
                ELSE
                    -- Exit if code hasn't changed
                    RETURN NEW;
                END IF;
            END IF;

            -- Create new app version
            WITH new_version AS (
                INSERT INTO app_versions (
                    id,
                    app_id,
                    version_number,
                    code,
                    created_at,
                    name,
                    description
                ) VALUES (
                    gen_random_uuid(),
                    _app_id,
                    _version_number,
                    _code,
                    NOW(),
                    _app_name,
                    _app_description
                ) RETURNING id
            )
            -- Update the app's current version
            UPDATE apps
            SET current_version_id = (SELECT id FROM new_version),
                updated_at = NOW()
            WHERE id = _app_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or replace the triggers
DROP TRIGGER IF EXISTS trigger_streamlit_message_insert ON messages;
DROP TRIGGER IF EXISTS trigger_streamlit_message_update ON messages;

-- Trigger for INSERT
CREATE TRIGGER trigger_streamlit_message_insert
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_streamlit_message();

-- Trigger for UPDATE of tool_results
CREATE TRIGGER trigger_streamlit_message_update
    AFTER UPDATE OF tool_results ON messages
    FOR EACH ROW
    EXECUTE FUNCTION handle_streamlit_message();