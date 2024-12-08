CREATE OR REPLACE FUNCTION handle_streamlit_tool_update()
RETURNS TRIGGER AS $$
DECLARE
    v_tool_result jsonb;
BEGIN
    -- Check if this is a Streamlit tool result
    IF NEW.tool_results IS NOT NULL THEN
        -- Extract the streamlit tool result from the array
        SELECT value INTO v_tool_result
        FROM jsonb_array_elements(NEW.tool_results)
        WHERE value->>'name' = 'streamlitTool'
        ORDER BY value->>'id' DESC
        LIMIT 1;

        RAISE NOTICE 'Tool Result: %', v_tool_result;

        IF v_tool_result IS NOT NULL 
           AND v_tool_result->>'result' IS NOT NULL 
           AND v_tool_result->>'app_name' IS NOT NULL 
           AND v_tool_result->>'app_description' IS NOT NULL 
        THEN
            -- Call handle_streamlit_tool_response RPC with the exact fields
            PERFORM handle_streamlit_tool_response(
                NEW.user_id,
                NEW.chat_id,
                v_tool_result->>'result',
                v_tool_result->>'app_name',
                v_tool_result->>'app_description'
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_streamlit_tool_update ON messages;
CREATE TRIGGER on_streamlit_tool_update
    AFTER INSERT OR UPDATE OF tool_results ON messages
    FOR EACH ROW
    WHEN (NEW.tool_results IS NOT NULL)
    EXECUTE FUNCTION handle_streamlit_tool_update();