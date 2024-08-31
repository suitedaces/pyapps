import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { GithubIcon } from 'lucide-react'

export function Navbar() {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="font-bold text-xl">CSV Streamlit Analyzer</Link>
          </div>
          <div>
            <Button variant="outline" onClick={() => window.open('https://github.com/yourusername/your-repo', '_blank')}>
              <GithubIcon className="mr-2 h-4 w-4" />
              Star on GitHub
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}