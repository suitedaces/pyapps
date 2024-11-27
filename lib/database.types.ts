export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            files: {
                Row: {
                    id: string
                    user_id: string
                    file_name: string
                    file_type: string
                    file_size: number
                    file_url: string
                    backup_url: string | null
                    content_hash: string | null
                    analysis: Json | null
                    expires_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    file_name: string
                    file_type: string
                    file_size: number
                    file_url: string
                    backup_url?: string | null
                    content_hash?: string | null
                    analysis?: Json | null
                    expires_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    file_name?: string
                    file_type?: string
                    file_size?: number
                    file_url?: string
                    backup_url?: string | null
                    content_hash?: string | null
                    analysis?: Json | null
                    expires_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'files_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            apps: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    description: string | null
                    is_public: boolean
                    public_id: string | null
                    current_version_id: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    description?: string | null
                    is_public?: boolean
                    public_id?: string | null
                    current_version_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    description?: string | null
                    is_public?: boolean
                    public_id?: string | null
                    current_version_id?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'apps_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'apps_current_version_id_fkey'
                        columns: ['current_version_id']
                        referencedRelation: 'app_versions'
                        referencedColumns: ['id']
                    },
                ]
            }
            app_versions: {
                Row: {
                    id: string
                    app_id: string
                    version_number: number
                    code: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    app_id: string
                    version_number: number
                    code: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    app_id?: string
                    version_number?: number
                    code?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'app_versions_app_id_fkey'
                        columns: ['app_id']
                        referencedRelation: 'apps'
                        referencedColumns: ['id']
                    },
                ]
            }
            chats: {
                Row: {
                    id: string
                    user_id: string
                    app_id: string | null
                    name: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    app_id?: string | null
                    name?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    app_id?: string | null
                    name?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'chats_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'chats_app_id_fkey'
                        columns: ['app_id']
                        referencedRelation: 'apps'
                        referencedColumns: ['id']
                    },
                ]
            }
            messages: {
                Row: {
                    id: string
                    chat_id: string
                    user_id: string
                    role: string
                    user_message: string
                    assistant_message: string
                    tool_calls: Json | null
                    tool_results: Json | null
                    token_count: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    chat_id: string
                    user_id: string
                    role: string
                    user_message: string
                    assistant_message: string
                    tool_calls?: Json | null
                    tool_results?: Json | null
                    token_count: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    chat_id?: string
                    user_id?: string
                    role?: string
                    user_message?: string
                    assistant_message?: string
                    tool_calls?: Json | null
                    tool_results?: Json | null
                    token_count?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'messages_chat_id_fkey'
                        columns: ['chat_id']
                        referencedRelation: 'chats'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'messages_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            chat_files: {
                Row: {
                    id: string
                    chat_id: string
                    file_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    chat_id: string
                    file_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    chat_id?: string
                    file_id?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'chat_files_chat_id_fkey'
                        columns: ['chat_id']
                        referencedRelation: 'chats'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'chat_files_file_id_fkey'
                        columns: ['file_id']
                        referencedRelation: 'files'
                        referencedColumns: ['id']
                    },
                ]
            }
            app_files: {
                Row: {
                    id: string
                    app_id: string
                    file_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    app_id: string
                    file_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    app_id?: string
                    file_id?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'app_files_app_id_fkey'
                        columns: ['app_id']
                        referencedRelation: 'apps'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'app_files_file_id_fkey'
                        columns: ['file_id']
                        referencedRelation: 'files'
                        referencedColumns: ['id']
                    },
                ]
            }
            usage_limits: {
                Row: {
                    id: string
                    user_id: string
                    chat_tokens_used: number
                    chat_tokens_limit: number
                    files_uploaded: number
                    files_upload_limit: number
                    storage_used: number
                    storage_limit: number
                    reset_date: string | null
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    chat_tokens_used?: number
                    chat_tokens_limit: number
                    files_uploaded?: number
                    files_upload_limit: number
                    storage_used?: number
                    storage_limit: number
                    reset_date?: string | null
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    chat_tokens_used?: number
                    chat_tokens_limit?: number
                    files_uploaded?: number
                    files_upload_limit?: number
                    storage_used?: number
                    storage_limit?: number
                    reset_date?: string | null
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'usage_limits_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'users'
                        referencedColumns: ['id']
                    },
                ]
            }
            users: {
                Row: {
                    id: string
                    full_name: string | null
                    avatar_url: string | null
                    created_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    avatar_url?: string | null
                    created_at?: string
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            initialize_usage_limits: {
                Args: Record<PropertyKey, never>
                Returns: undefined
            }
            update_app_public_status: {
                Args: {
                    p_app_id: string
                    p_version_id: string
                    v_public_id: string
                }
                Returns: Json
            }
            get_expired_files: {
                Args: {
                    cutoff_date?: string
                }
                Returns: {
                    id: string
                    file_name: string
                    expires_at: string
                }[]
            }
            insert_message: {
                Args: {
                    p_chat_id: string
                    p_user_id: string
                    p_user_message: string
                    p_assistant_message: string
                    p_token_count: number
                    p_tool_calls?: Json
                    p_tool_results?: Json
                }
                Returns: string
            }
            get_chat_messages: {
                Args: {
                    p_chat_id: string
                    p_limit?: number
                    p_offset?: number
                }
                Returns: {
                    id: string
                    user_id: string
                    user_message: string
                    assistant_message: string
                    tool_calls: Json
                    tool_results: Json
                    token_count: number
                    created_at: string
                }[]
            }
            get_latest_messages_by_chat: {
                Args: {
                    p_user_id: string
                    p_limit?: number
                }
                Returns: {
                    chat_id: string
                    message_id: string
                    user_message: string
                    assistant_message: string
                    created_at: string
                }[]
            }
            get_user_total_tokens: {
                Args: {
                    p_user_id: string
                }
                Returns: number
            }
            create_app_version: {
                Args: {
                    p_app_id: string
                    p_code: string
                }
                Returns: {
                    version_id: string
                    version_number: number
                    app_id: string
                    created_at: string
                }
            }
            switch_app_version: {
                Args: {
                    p_app_id: string
                    p_version_id: string
                }
                Returns: {
                    success: boolean
                    app_id: string
                    version_id: string
                    switched_at: string
                }
            }
            get_app_versions: {
                Args: {
                    p_app_id: string
                }
                Returns: {
                    id: string
                    version_number: number
                    code: string
                    created_at: string
                    is_current: boolean
                }[]
            }
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
