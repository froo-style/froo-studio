import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        froo: { primary: '#C0392B', secondary: '#F9E8E4' },
        sweet: { primary: '#F4C2C2', secondary: '#FFFFFF' },
        prairie: { primary: '#8FAF8A', secondary: '#F5F0E8' },
        soiree: { primary: '#EDE0E8', secondary: '#FAFAFA' },
      },
    },
  },
  plugins: [],
}
export default config
