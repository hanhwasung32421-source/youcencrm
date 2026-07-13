// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxtjs/tailwindcss'],
  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    signupChallengeSecret: process.env.SIGNUP_CHALLENGE_SECRET || 'change-me',
    youtubeApiKey: process.env.YOUTUBE_API_KEY || '',

    // Exposed to client
    public: {
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ''
    }
  }
})
