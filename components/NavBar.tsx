import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'

interface NavbarProps {
    sheetTrigger: React.ReactNode;
}

export function Navbar({ sheetTrigger }: NavbarProps) {
    return (
        <nav className="border-b border-black bg-bg">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="font-bold text-xl text-black">Grunty 🧐</Link>
                    </div>
                    <div>
                        <Button variant="outline" onClick={() => window.open('https://github.com/yourusername/your-repo', '_blank')} className="text-black border-gray-600 hover:bg-gray-800">
                            <Github className="mr-2 h-4 w-4" />
                            Star on GitHub
                        </Button>
                    </div>

                    {sheetTrigger}
                </div>
            </div>
        </nav>
    )
}
