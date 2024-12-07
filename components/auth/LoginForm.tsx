'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'

export function LoginForm() {
  const supabase = createClientComponentClient()

  const handleSignInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-4">
        <Button 
          onClick={handleSignInWithGoogle}
          className="w-full"
        >
          Sign in with Google
        </Button>
      </div>
    </div>
  )
} 