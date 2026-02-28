import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://172.17.136.3:8001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://172.17.136.3:8001",
        changeOrigin: true,
      },
    },
  },
});
