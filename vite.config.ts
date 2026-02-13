
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Injects the API_KEY from Vercel Environment Variables at build time
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || '')
  }
});
