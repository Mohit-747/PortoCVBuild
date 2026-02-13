
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Safely inject the API key, defaulting to empty string if missing during build
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'AIzaSyBlXrNywkVoxJRUD6g7wNpywmT4KcJsXuc')
  }
});
