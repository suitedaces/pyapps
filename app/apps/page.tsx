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
  const { session } = useAuth();
  const router = useRouter();

  const fetchApps = useCallback(async (pageIndex: number, search: string) => {
    if (loadingRef.current || !session?.user?.id) return;
    
    try {
      loadingRef.current = true;
      setLoading(true);
      
      let query = supabase
        .from('apps')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .range(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE - 1);

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      if (pageIndex === 0) {
        setApps(data || []);
      } else {
        setApps(prev => [...prev, ...(data || [])]);
      }

      setHasMore(count ? (pageIndex + 1) * ITEMS_PER_PAGE < count : false);
    } catch (error) {
      console.error('Error fetching apps:', error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setInitialLoad(false);
    }
  }, [supabase, session?.user?.id]);

  const debouncedSearch = useCallback(
    debounce((search: string) => {
      setPage(0);
      fetchApps(0, search);
    }, 300),
    [fetchApps]
  );

  useEffect(() => {
    fetchApps(0, '');
  }, [fetchApps]);

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
            {apps.map((app) => (
              <AppCard
                key={app.id}
                name={app.name}
                description={app.description}
                updatedAt={new Date(app.updated_at).toLocaleDateString()}
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
  const [showDetails, setShowDetails] = useState(false)
  const [selectedApp, setSelectedApp] = useState<AppData | null>(null)
  const [chats, setChats] = useState<any[]>([])
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({})
  const [isCreatingChat, setIsCreatingChat] = useState(false)
  const router = useRouter()

  const handleAppSelect = (app: AppData) => {
    setSelectedApp(app)
    setShowDetails(true)
  }

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
      rightPanel={
        selectedApp ? (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">App Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="text-sm">{selectedApp.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="text-sm">{selectedApp.description || 'No description'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="text-sm">{new Date(selectedApp.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">App Details</h2>
            <p className="text-sm text-muted-foreground">Select an app to view details</p>
          </div>
        )
      }
      showRightPanel={showDetails}
      onToggleRightPanel={() => setShowDetails(!showDetails)}
      chats={chats}
      chatTitles={chatTitles}
      currentChatId={null}
      isCreatingChat={isCreatingChat}
      onChatSelect={(id) => router.push(`/chat/${id}`)}
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
        <AppsContent onAppSelect={handleAppSelect} />
      </Suspense>
    </AppLayout>
  )
} 