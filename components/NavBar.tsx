import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'
import { useUser } from '@auth0/nextjs-auth0/client'

export function Navbar() {
  const { user, isLoading } = useUser()

  return (
    <nav className="border-b border-gray-700 bg-gray-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="font-bold text-xl text-white">Grunty 🧐</Link>
          </div>
          <div className="flex items-center">
            {!isLoading && (
              <>
                {user ? (
                  <Link href="/api/auth/logout">
                    <Button variant="outline" className="text-white border-gray-600 hover:bg-gray-800">
                      Log out
                    </Button>
                  </Link>
                ) : (
                  <Link href="/api/auth/login">
                    <Button variant="outline" className="text-white border-gray-600 hover:bg-gray-800">
                      Log in
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}