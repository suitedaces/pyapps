-- Drop existing functions first
DROP FUNCTION IF EXISTS handle_streamlit_tool_response(uuid,uuid,text,text,text);

-- Add name and description columns to app_versions
ALTER TABLE app_versions 
ADD COLUMN name text,
ADD COLUMN description text;

-- Update the create_app_version function to include name
CREATE OR REPLACE FUNCTION create_app_version(
    p_app_id uuid,
    p_code text,
    p_name text DEFAULT NULL,
    p_description text DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_version_number INT;
    v_new_version_id UUID;
BEGIN
    -- Calculate next version number
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_version_number
    FROM app_versions
    WHERE app_id = p_app_id;

    -- Create new version with name
    INSERT INTO app_versions (
        id,
        app_id,
        version_number,
        code,
        name,
        description,
        created_at
    )
    VALUES (
        gen_random_uuid(),
        p_app_id,
        v_version_number,
        p_code,
        p_name,
        p_description,
        CURRENT_TIMESTAMP
    )
    RETURNING id INTO v_new_version_id;

    -- Update app's current version
    UPDATE apps
    SET 
        current_version_id = v_new_version_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_app_id;

    RETURN jsonb_build_object(
        'version_id', v_new_version_id,
        'version_number', v_version_number,
        'app_id', p_app_id,
        'name', p_name,
        'description', p_description,
        'created_at', CURRENT_TIMESTAMP
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the new handle_streamlit_tool_response function
CREATE OR REPLACE FUNCTION handle_streamlit_tool_response(
    p_user_id uuid,
    p_chat_id uuid,
    p_code text,
    p_name text,
    p_description text
) RETURNS jsonb AS $$
DECLARE
    v_app_id uuid;
    v_version_result jsonb;
    v_existing_app_id uuid;
BEGIN
    -- Check if chat already has an app
    SELECT app_id INTO v_existing_app_id
    FROM chats
    WHERE id = p_chat_id;

    IF v_existing_app_id IS NULL THEN
        -- Create new app with name from the tool response
        INSERT INTO apps (
            user_id,
            name,                   -- Add name here
            description,            -- Add description here
            is_public,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_name,                 -- Use the provided name
            p_description,          -- Use the provided description
            false,
            now(),
            now()
        ) RETURNING id INTO v_app_id;

        -- Link app to chat
        UPDATE chats
        SET app_id = v_app_id
        WHERE id = p_chat_id;
    ELSE
        v_app_id := v_existing_app_id;
        
        -- Update existing app's name and description
        UPDATE apps
        SET 
            name = p_name,
            description = p_description,
            updated_at = now()
        WHERE id = v_app_id;
    END IF;

    -- Create new version with name and description
    SELECT create_app_version(v_app_id, p_code, p_name, p_description) INTO v_version_result;

    RETURN jsonb_build_object(
        'app_id', v_app_id,
        'version_id', v_version_result->>'version_id',
        'version_number', (v_version_result->>'version_number')::int,
        'created_at', v_version_result->>'created_at',
        'is_update', v_existing_app_id IS NOT NULL,
        'name', v_version_result->>'name',
        'description', v_version_result->>'description'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;