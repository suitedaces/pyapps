import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'
import { useUser } from '@auth0/nextjs-auth0/client';

export function Navbar() {
  const { user, error, isLoading } = useUser();

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
            {isLoading ? (
              <p>Loading...</p>
            ) : error ? (
              <p>Error: {error.message}</p>
            ) : user ? (
              <div className="flex items-center">
                <span className="text-white mr-4">{user.name}</span>
                <a href="/api/auth/logout" className="text-white hover:text-gray-300">
                  Logout
                </a>
              </div>
            ) : (
              <a href="/api/auth/login" className="text-white hover:text-gray-300">
                Login
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}