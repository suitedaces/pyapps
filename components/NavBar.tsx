import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Github } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetClose } from './ui/sheet'
import { Label } from './ui/label'
import { Input } from './ui/input'

export function Navbar() {
    return (
        <nav className="border-b border-gray-700 bg-gray-900">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="font-bold text-xl text-white">Grunty 🧐</Link>
                    </div>
                    <div>
                        <Button variant="outline" onClick={() => window.open('https://github.com/yourusername/your-repo', '_blank')} className="text-white border-gray-600 hover:bg-gray-800">
                            <Github className="mr-2 h-4 w-4" />
                            Star on GitHub
                        </Button>
                    </div>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button className='bg-accent text-accent-foreground'>Open</Button>
                        </SheetTrigger>
                        <SheetContent>
                            <SheetHeader>
                                <SheetTitle>Edit profile</SheetTitle>
                                <SheetDescription>
                                    Make changes to your profile here. Click save when youre done.
                                </SheetDescription>
                            </SheetHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="name" className="text-right">
                                        Name
                                    </Label>
                                    <Input id="name" value="Pedro Duarte" className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="username" className="text-right">
                                        Username
                                    </Label>
                                    <Input id="username" value="@peduarte" className="col-span-3" />
                                </div>
                            </div>
                            <SheetFooter>
                                <SheetClose asChild>
                                    <Button type="submit">Save changes</Button>
                                </SheetClose>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </nav>
    )
}
