import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { Session } from '@supabase/supabase-js' 

interface NavbarProps {
  isRightContentVisible: boolean;
}

export function Navbar({ isRightContentVisible }: NavbarProps) {
  const [session, setSession] = useState<Session | null>(null)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  const [windowWidth, setWindowWidth] = useState(0)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const slideDistance = isRightContentVisible ? 0 : windowWidth / 8

  return (
    <motion.nav
      className="bg-bg"
      animate={{ x: slideDistance }}
      transition={{ type: "ease", stiffness: 300, damping: 30 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="font-bold text-xl text-black">Grunty 🧐</Link>
          </div>

          {session ? (
            <div className="relative">
              {/* Avatar */}
              <div
                onMouseEnter={() => setIsDropdownOpen(true)}
                onMouseLeave={() => setIsDropdownOpen(false)}
                className="relative flex items-center cursor-pointer"
              >
                <Avatar className="w-10 h-10 border-2 border-gray-300 rounded-full">
                  <AvatarImage src={session.user.avatar_url || "/default-avatar.png"} alt="User Avatar" />
                  <AvatarFallback>U</AvatarFallback>
                </Avatar>

                {/* Dropdown */}
                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-32 mr-8 w-48 z-200 bg-white border border-gray-200 shadow-lg rounded-lg"
                  >
                    <div className="p-4">
                      <p className="text-xs text-gray-500">{session.user.email}</p>
                      <Button
                        className="w-full mt-2 bg-red-500 hover:bg-red-600 text-white"
                        onClick={handleSignOut}
                      >
                        Sign Out
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          ) : (
            <Button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="text-white hover:text-gray-300">
              Login
            </Button>
          )}
        </div>
      </div>
    </motion.nav>
  )
}
