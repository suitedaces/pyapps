-- Enable RLS on all tables
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_limits ENABLE ROW LEVEL SECURITY;

-- Files table policies
CREATE POLICY "Users can view their own files" ON public.files
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own files" ON public.files
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own files" ON public.files
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own files" ON public.files
    FOR DELETE USING (auth.uid() = user_id);

-- Apps table policies
DROP POLICY IF EXISTS "Users can view their own apps or public apps" ON public.apps;
DROP POLICY IF EXISTS "Anyone can view public apps" ON public.apps;
DROP POLICY IF EXISTS "Users can view versions of their own apps or public apps" ON public.app_versions;
DROP POLICY IF EXISTS "Anyone can view versions of public apps" ON public.app_versions;

CREATE POLICY "Anyone can view public apps" ON public.apps
    FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can view their own apps" ON public.apps
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own apps" ON public.apps
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own apps" ON public.apps
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own apps" ON public.apps
    FOR DELETE USING (auth.uid() = user_id);

-- App versions table policies
CREATE POLICY "Anyone can view versions of public apps" ON public.app_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.apps
            WHERE apps.id = app_versions.app_id
            AND apps.is_public = TRUE
        )
    );

CREATE POLICY "Users can view versions of their own apps" ON public.app_versions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.apps
            WHERE apps.id = app_versions.app_id
            AND apps.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert versions to their own apps" ON public.app_versions
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.apps
        WHERE apps.id = app_versions.app_id AND apps.user_id = auth.uid()
    ));

CREATE POLICY "Users can update versions of their own apps" ON public.app_versions
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.apps
        WHERE apps.id = app_versions.app_id AND apps.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete versions of their own apps" ON public.app_versions
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.apps
        WHERE apps.id = app_versions.app_id AND apps.user_id = auth.uid()
    ));

-- Chats table policies
CREATE POLICY "Users can view their own chats" ON public.chats
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own chats" ON public.chats
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own chats" ON public.chats
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own chats" ON public.chats
    FOR DELETE USING (auth.uid() = user_id);

-- Messages table policies
CREATE POLICY "Users can view messages in their own chats" ON public.messages
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    ));
CREATE POLICY "Users can insert messages in their own chats" ON public.messages
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    ));
CREATE POLICY "Users can update messages in their own chats" ON public.messages
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    ));
CREATE POLICY "Users can delete messages in their own chats" ON public.messages
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = messages.chat_id AND chats.user_id = auth.uid()
    ));

-- Chat files table policies
CREATE POLICY "Users can view chat files for their own chats" ON public.chat_files
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = chat_files.chat_id AND chats.user_id = auth.uid()
    ));
CREATE POLICY "Users can insert chat files for their own chats" ON public.chat_files
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = chat_files.chat_id AND chats.user_id = auth.uid()
    ));
CREATE POLICY "Users can delete chat files for their own chats" ON public.chat_files
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.chats
        WHERE chats.id = chat_files.chat_id AND chats.user_id = auth.uid()
    ));

-- App files table policies
CREATE POLICY "Users can view app files for their own apps or public apps" ON public.app_files
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.apps
        WHERE apps.id = app_files.app_id
        AND (apps.user_id = auth.uid() OR apps.is_public = TRUE)
    ));
CREATE POLICY "Users can insert app files for their own apps" ON public.app_files
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM public.apps
        WHERE apps.id = app_files.app_id AND apps.user_id = auth.uid()
    ));
CREATE POLICY "Users can delete app files for their own apps" ON public.app_files
    FOR DELETE USING (EXISTS (
        SELECT 1 FROM public.apps
        WHERE apps.id = app_files.app_id AND apps.user_id = auth.uid()
    ));

-- Usage limits table policies
CREATE POLICY "Users can view their own usage limits" ON public.usage_limits
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own usage limits" ON public.usage_limits
    FOR UPDATE USING (auth.uid() = user_id);