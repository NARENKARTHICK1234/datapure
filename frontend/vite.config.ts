import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Dev server: proxy /api to local FastAPI backend
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  // Production build output directory (Render publish dir = frontend/dist)
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2048,
  },
});
