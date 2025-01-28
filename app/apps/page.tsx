'use client'

import { Suspense } from 'react'
import { AppCard } from "@/components/AppCard";
import { Search, Plus, Filter } from "lucide-react";
import { useEffect, useState, useCallback, useRef } from "react";
import { AppData } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { LoadingCards } from "@/components/LoadingCards";
import { AppLayout } from "@/components/AppLayout";
import { useInView } from "react-intersection-observer";
import debounce from 'lodash/debounce';
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { AuthPrompt } from '@/components/ui/auth-prompt'

const ITEMS_PER_PAGE = 12;

function AppsContent({ onAppSelect }: { onAppSelect: (app: AppData) => void }) {
  const [apps, setApps] = useState<AppData[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const supabase = createClient();
  const { ref, inView } = useInView();
  const loadingRef = useRef(false);
  const { session, isPreviewMode } = useAuth();
  const router = useRouter();

  const fetchApps = useCallback(async (pageIndex: number, search: string) => {
    if (loadingRef.current || !session?.user?.id) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      
      let query = supabase
        .from('apps')
        .select(`
          id,
          user_id,
          name,
          description,
          updated_at,
          current_version_id,
          current_version:app_versions!fk_current_version!inner(
            version_number
          )
        `)
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .range(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      console.log('Fetched apps data:', JSON.stringify(data, null, 2));
      const apps = data?.map(app => ({
        id: app.id,
        user_id: app.user_id,
        name: app.name,
        description: app.description,
        updated_at: app.updated_at,
        currentVersionNumber: (app.current_version as any)?.version_number
      }));

      if (pageIndex === 0) {
        setApps(apps as any[]);
      } else {
        setApps(prev => [...prev, ...apps] as any[]);
      }

      setHasMore(data?.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching apps:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoad(false);
    }
  }, [session?.user?.id]);

  const debouncedSearch = useCallback(
    debounce((search: string) => {
      setPage(0);
      fetchApps(0, search);
    }, 300),
    [fetchApps]
  );

  useEffect(() => {
    const fetchApps = async () => {
      if (!session?.user?.id) return
      
      try {
        loadingRef.current = true
        setLoading(true)
        
        let query = supabase
          .from('apps')
          .select('*', { count: 'exact' })
          .eq('user_id', session.user.id)
          .order('updated_at', { ascending: false })
          .range(0 * ITEMS_PER_PAGE, (0 + 1) * ITEMS_PER_PAGE - 1)

        const { data, error, count } = await query

        if (error) throw error

        setApps(data || [])
        setHasMore(count ? (0 + 1) * ITEMS_PER_PAGE < count : false)
      } catch (error) {
        console.error('Error fetching apps:', error)
      } finally {
        loadingRef.current = false
        setLoading(false)
        setInitialLoad(false)
      }
    }

    fetchApps()
  }, [supabase, session?.user?.id])

  useEffect(() => {
    if (!initialLoad) {
      debouncedSearch(searchQuery);
    }
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch, initialLoad]);

  useEffect(() => {
    if (inView && hasMore && !loadingRef.current) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchApps(nextPage, searchQuery);
    }
  }, [inView, hasMore, page, fetchApps, searchQuery]);

  if (isPreviewMode) {
    return <AuthPrompt canClose={false} />
  }

  if (initialLoad) {
    return <LoadingCards />;
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] w-full relative">
      <div className="max-w-7xl mx-auto px-4 relative z-50">
        <div className="flex items-center gap-4 py-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/50 h-4 w-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 bg-transparent text-foreground placeholder:text-foreground/50 outline-none"
            />
          </div>
          <button
            onClick={() => router.push('/')} 
            className="flex items-center gap-2 text-foreground hover:text-foreground/70 transition-colors"
          >
            <Plus size={16} />
            New App
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-7.5rem)]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apps.map((app: any) => (
              <AppCard
                key={app.id}
                id={app.id}
                userId={session?.user?.id || ''}
                name={app.name}
                description={app.description}
                updatedAt={new Date(app.updated_at).toLocaleDateString()}
                currentVersionNumber={app.currentVersionNumber}
                onClick={() => {
                  router.push(`/apps/${app.id}`)
                  onAppSelect?.(app)
                }}
              />
            ))}
          </div>

          {loading && !initialLoad && <LoadingCards />}
          
          <div ref={ref} className="h-10" />
        </div>
      </div>
    </div>
  );
}

export default function AppsPage() {
  const [chats, setChats] = useState<any[]>([])
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const fetchChats = async () => {
      const response = await fetch('/api/chats')
      const data = await response.json()
      setChats(data.chats || [])
    }
    fetchChats()
  }, [])

  return (
    <AppLayout
      rightPanel={null}
      showRightPanel={false}
      onToggleRightPanel={() => {}}
      chats={chats}
      chatTitles={chatTitles}
      currentChatId={null}
      isCreatingChat={isCreatingChat}
      onChatSelect={(id) => router.push(`/projects/${id}`)}
      onGenerateTitle={async () => null}
      onChatDeleted={() => {
        const fetchChats = async () => {
          const response = await fetch('/api/chats')
          const data = await response.json()
          setChats(data.chats || [])
        }
        fetchChats()
      }}
    >
      <Suspense fallback={<LoadingCards />}>
        <AppsContent onAppSelect={() => {}} />
      </Suspense>
    </AppLayout>
  );
} 