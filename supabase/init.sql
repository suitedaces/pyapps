-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add custom fields to the auth.users table
ALTER TABLE auth.users 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Files table
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_url TEXT NOT NULL,
    backup_url TEXT,
    content_hash TEXT,
    analysis JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Apps table
CREATE TABLE public.apps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    public_id TEXT UNIQUE,
    current_version_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- App versions table
CREATE TABLE public.app_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID REFERENCES public.apps(id),
    version_number INTEGER NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (app_id, version_number)
);

-- Add foreign key constraint for current_version_id in apps table
ALTER TABLE public.apps
ADD CONSTRAINT fk_current_version
FOREIGN KEY (current_version_id)
REFERENCES public.app_versions(id);

-- Chats table
CREATE TABLE public.chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    app_id UUID REFERENCES public.apps(id),
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages table
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES public.chats(id),
    user_id UUID REFERENCES auth.users(id),
    tool_calls JSONB,
    tool_results JSONB,
    user_message TEXT NOT NULL,
    assistant_message TEXT NOT NULL,
    token_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat files table
CREATE TABLE public.chat_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID REFERENCES public.chats(id),
    file_id UUID REFERENCES public.files(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- App files table
CREATE TABLE public.app_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id UUID REFERENCES public.apps(id),
    file_id UUID REFERENCES public.files(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Usage limits table
CREATE TABLE public.usage_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    chat_tokens_used INTEGER DEFAULT 0,
    chat_tokens_limit INTEGER NOT NULL,
    files_uploaded INTEGER DEFAULT 0,
    files_upload_limit INTEGER NOT NULL,
    storage_used BIGINT DEFAULT 0,
    storage_limit BIGINT NOT NULL,
    reset_date TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);


-- Indexes
CREATE INDEX idx_files_user_id ON public.files(user_id);
CREATE INDEX idx_files_expires_at ON public.files(expires_at);
CREATE INDEX idx_apps_user_id ON public.apps(user_id);
CREATE INDEX idx_apps_public ON public.apps(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_app_versions_app_id ON public.app_versions(app_id);
CREATE INDEX idx_app_versions_app_id_version ON public.app_versions(app_id, version_number);
CREATE INDEX idx_chats_user_id ON public.chats(user_id);
CREATE INDEX idx_chats_app_id ON public.chats(app_id);
CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_chat_files_chat_id ON public.chat_files(chat_id);
CREATE INDEX idx_chat_files_file_id ON public.chat_files(file_id);
CREATE INDEX idx_app_files_app_id ON public.app_files(app_id);
CREATE INDEX idx_app_files_file_id ON public.app_files(file_id);
CREATE INDEX idx_message_pairs_chat_id ON public.messages(chat_id);
CREATE INDEX idx_message_pairs_user_id ON public.messages(user_id);


-- Function to initialize usage limits for new users
CREATE OR REPLACE FUNCTION public.initialize_usage_limits()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usage_limits (user_id, chat_tokens_limit, files_upload_limit, storage_limit)
  VALUES (NEW.id, 1000000, 100, 1073741824);  -- 1M tokens, 100 files, 1GB storage
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.initialize_usage_limits();


  -- Update the app's public status, URL, and current version
CREATE OR REPLACE FUNCTION public.update_app_public_status(
    p_app_id UUID,
    p_version_id UUID,
    v_public_id TEXT
) RETURNS JSONB AS $$
BEGIN
  -- Update the app's public status, URL, and current version
  UPDATE public.apps
  SET is_public = TRUE, 
      public_id = v_public_id, 
      current_version_id = p_version_id,
      updated_at = now()
  WHERE id = p_app_id;

  -- Return the public ID as part of a JSON object
  RETURN json_build_object('public_id', v_public_id);
END;
$$ LANGUAGE plpgsql;


-- Function to get expired files
CREATE OR REPLACE FUNCTION public.get_expired_files(cutoff_date TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (id UUID, file_name TEXT, expires_at TIMESTAMPTZ) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.file_name, f.expires_at
  FROM public.files f
  WHERE f.expires_at IS NOT NULL AND f.expires_at <= cutoff_date;
END;
$$ LANGUAGE plpgsql;


-- Function to insert a new message
CREATE OR REPLACE FUNCTION public.insert_message(
    p_chat_id UUID,
    p_user_id UUID,
    p_user_message TEXT,
    p_assistant_message TEXT,
    p_token_count INTEGER,
    p_tool_calls JSONB DEFAULT NULL,
    p_tool_results JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
BEGIN
    INSERT INTO public.messages (
        chat_id,
        user_id,
        user_message,
        assistant_message,
        tool_calls,
        tool_results,
        token_count
    )
    VALUES (
        p_chat_id,
        p_user_id,
        p_user_message,
        p_assistant_message,
        p_tool_calls,
        p_tool_results,
        p_token_count
    )
    RETURNING id INTO v_message_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get messages for a chat with pagination
CREATE OR REPLACE FUNCTION public.get_chat_messages(
    p_chat_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
) RETURNS TABLE (
    id UUID,
    user_id UUID,
    user_message TEXT,
    assistant_message TEXT,
    tool_calls JSONB,
    tool_results JSONB,
    token_count INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.user_id,
        m.user_message,
        m.assistant_message,
        m.tool_calls,
        m.tool_results,
        m.token_count,
        m.created_at
    FROM public.messages m
    WHERE m.chat_id = p_chat_id
    ORDER BY m.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Function to get the latest message for each chat
CREATE OR REPLACE FUNCTION public.get_latest_messages_by_chat(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    chat_id UUID,
    message_id UUID,
    user_message TEXT,
    assistant_message TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    WITH ranked_messages AS (
        SELECT 
            m.chat_id,
            m.id AS message_id,
            m.user_message,
            m.assistant_message,
            m.created_at,
            ROW_NUMBER() OVER (PARTITION BY m.chat_id ORDER BY m.created_at DESC) AS rn
        FROM public.messages m
        JOIN public.chats c ON m.chat_id = c.id
        WHERE c.user_id = p_user_id
    )
    SELECT 
        rm.chat_id,
        rm.message_id,
        rm.user_message,
        rm.assistant_message,
        rm.created_at
    FROM ranked_messages rm
    WHERE rm.rn = 1
    ORDER BY rm.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- Function to get total token count for a user
CREATE OR REPLACE FUNCTION public.get_user_total_tokens(
    p_user_id UUID
) RETURNS BIGINT AS $$
DECLARE
    total_tokens BIGINT;
BEGIN
    SELECT COALESCE(SUM(m.token_count), 0)
    INTO total_tokens
    FROM public.messages m
    JOIN public.chats c ON m.chat_id = c.id
    WHERE c.user_id = p_user_id;
    
    RETURN total_tokens;
END;
$$ LANGUAGE plpgsql;