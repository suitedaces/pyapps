import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'

export function Navbar() {
  const [session, setSession] = useState<Session | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <nav className="border-b border-gray-700 bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="font-bold text-xl text-white">Grunty 🧐</Link>
          </div>
          <div className="flex items-center">
            <Button variant="outline" onClick={() => window.open('https://github.com/yourusername/your-repo', '_blank')} className="text-white border-gray-600 hover:bg-gray-800 mr-4">
              <Github className="mr-2 h-4 w-4" />
              Star on GitHub
            </Button>
            {session ? (
              <div className="flex items-center">
                <span className="text-white mr-4">{session.user.email}</span>
                <button onClick={handleSignOut} className="text-white hover:text-gray-300">
                  Logout
                </button>
              </div>
            ) : (
              <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="text-white hover:text-gray-300">
                Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}