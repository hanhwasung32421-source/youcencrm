import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [
    './app/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './plugins/**/*.{js,ts}',
    './composables/**/*.{js,ts}',
    './middleware/**/*.{js,ts}',
    './server/**/*.{js,ts}'
  ],
  theme: {
    extend: {}
  },
  plugins: []
}

