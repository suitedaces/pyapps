'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Settings, SidebarIcon } from 'lucide-react'
import Link from 'next/link'

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleSidebar = () => setIsOpen(!isOpen)

  const sidebarVariants = {
    open: { x: 0 },
    closed: { x: '-100%' },
  }

  const mainContentVariants = {
    open: { marginLeft: '16rem' },
    closed: { marginLeft: '0' },
  }

  return (
    <div className="relative">
      <Button
        onClick={toggleSidebar}
        className="fixed top-2 left-4 z-30"
        size="icon"
        // variant="outline"
      >
        <SidebarIcon className="h-4 w-4" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>

      <motion.div
        initial="closed"
        animate={isOpen ? 'open' : 'closed'}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 bottom-0 w-64 bg-matte text-white p-4 z-20"
      >
        <div className="flex flex-col h-full">

          <div className="flex-grow mt-20 overflow-auto">
              <Link href="#"
                className="block py-2 px-3 mb-1 rounded-lg hover:bg-gray-700 transition-colors"
              >
                File
              </Link>
              <Link href="#"
                className="block py-2 px-3 mb-1 rounded-lg hover:bg-gray-700 transition-colors"
              >
                App
              </Link>
          </div>

          <div className="mt-auto pt-4 border-t border-white/20">
            <Button className="w-full justify-start text-text">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
