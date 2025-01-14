import { useAuth } from '@/contexts/AuthContext'
import { useSidebar } from '@/contexts/SidebarContext'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './ui/button'
import AppSidebar from './Sidebar'
import { AuthPrompt } from './ui/auth-prompt'
import LoadingAnimation from './LoadingAnimation'
import { useRouter } from 'next/navigation'

interface AppLayoutProps {
  children: React.ReactNode
  rightPanel: React.ReactNode
  showRightPanel: boolean
  onToggleRightPanel: () => void
  chats: any[]
  chatTitles: Record<string, string>
  currentChatId: string | null
  isCreatingChat: boolean
  onChatSelect: (id: string) => void
  onGenerateTitle: (id: string) => Promise<string | null>
  onChatDeleted: () => void
}

export function AppLayout({ 
  children, 
  rightPanel,
  showRightPanel,
  onToggleRightPanel,
  chats,
  chatTitles,
  currentChatId,
  isCreatingChat,
  onChatSelect,
  onGenerateTitle,
  onChatDeleted
}: AppLayoutProps) {
  const { session, isLoading, shouldShowAuthPrompt } = useAuth()
  const { collapsed: sidebarCollapsed } = useSidebar()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="relative h-screen w-full">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-0" />
        <LoadingAnimation message="Loading..." />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-dark-app relative flex h-screen overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="godrays top-0 left-0 w-full min-h-[30vh] relative z-5">
          <div className="godrays-overlay dark:mix-blend-darken z-10" />
        </div>
      </div>

      <AppSidebar
        chats={chats}
        chatTitles={chatTitles}
        currentChatId={currentChatId}
        isCreatingChat={isCreatingChat}
        onChatSelect={onChatSelect}
        onGenerateTitle={onGenerateTitle}
        onChatDeleted={onChatDeleted}
      />

      <div className="flex-1 flex flex-col bg-white dark:bg-dark-app min-w-0">
        {sidebarCollapsed && (
          <div
            className="fixed top-0 h-14 flex items-center z-20 transition-all duration-200"
            style={{
              left: '4rem',
              right: 0,
            }}
          />
        )}

        <main className={cn(
          'flex-grow flex px-2 pr-9 flex-col lg:flex-row overflow-hidden justify-center relative',
          'h-screen pt-14'
        )}>
          <div className="w-full relative flex flex-col h-[calc(100vh-4rem)]">
            {children}
          </div>

          {showRightPanel && (
            <div className={cn(
              "fixed right-0 top-14 h-[calc(100vh-3.5rem)] w-1/3 bg-white dark:bg-dark-app border-l border-gray-200 dark:border-dark-border transform transition-transform duration-300",
              showRightPanel ? "translate-x-0" : "translate-x-full"
            )}>
              {rightPanel}
            </div>
          )}

          {showRightPanel && (
            <Button
              onClick={onToggleRightPanel}
              className={cn(
                'fixed right-4 top-4 z-30',
                'bg-black dark:bg-dark-background dark:border-neutral-400 hover:bg-black/90',
                'text-white',
                'border border-transparent dark:border-dark-border',
                'transition-all duration-200 ease-in-out',
                'shadow-lg hover:shadow-xl',
                'rounded-lg'
              )}
              size="icon"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </main>
      </div>

      {shouldShowAuthPrompt && <AuthPrompt />}
    </div>
  )
} 