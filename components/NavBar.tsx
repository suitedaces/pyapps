import Link from 'next/link'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'

interface NavbarProps {
    sheetTrigger: React.ReactNode;
    isRightContentVisible: boolean;
}

// export function Navbar({ sheetTrigger }: NavbarProps) {
export function Navbar({ isRightContentVisible }: NavbarProps) {
    const [windowWidth, setWindowWidth] = useState(0)

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
            <div className="container mx-10 px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="font-bold text-xl text-black">Grunty 🧐</Link>
                    </div>

                    {/* {sheetTrigger} */}
                </div>
            </div>
        </motion.nav>
    )
}
