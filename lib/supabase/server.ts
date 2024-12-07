import { cookies } from "next/headers";
import { Database } from "../database.types";
import { createServerClient } from "@supabase/ssr";

export const createClient = async () => {
    const cookieStore = await cookies();
  
    return createServerClient<Database>(
      // Pass Supabase URL and anonymous key from the environment to the client
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  
      // Define a cookies object with methods for interacting with the cookie store and pass it to the client
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          }
        }
      }
    );
  };

export const getSession = async () => {
    const supabase = await createClient()
    const {
        data: { session },
    } = await supabase.auth.getSession()
    return session
}