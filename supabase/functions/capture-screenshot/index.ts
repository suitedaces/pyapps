import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import puppeteer from 'https://deno.land/x/puppeteer@16.2.0/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    // Parse the request body
    const { url, appId, versionId, userId } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Launch browser
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1200, height: 800 })

      // Navigate to URL and wait for Streamlit
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
      await page.waitForSelector('.stApp', { timeout: 30000 })
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Capture screenshot
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: false
      })

      // Upload to Supabase Storage
      const timestamp = new Date().getTime()
      const filePath = `screenshots/${appId}/${versionId}_${timestamp}.png`
      
      const { error: uploadError } = await supabaseClient
        .storage
        .from('app-screenshots')
        .upload(filePath, screenshot, {
          contentType: 'image/png',
          cacheControl: '3600'
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabaseClient
        .storage
        .from('app-screenshots')
        .getPublicUrl(filePath)

      // Update app_version with screenshot URL
      const { error: updateError } = await supabaseClient
        .from('app_versions')
        .update({ screenshot_url: publicUrl })
        .eq('id', versionId)

      if (updateError) throw updateError

      return new Response(
        JSON.stringify({ success: true, screenshotUrl: publicUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } finally {
      await browser.close()
    }

  } catch (error) {
    console.error('Screenshot capture failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})