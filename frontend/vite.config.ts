import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";

export default defineConfig(() => {
  const isDocker = fs.existsSync("/.dockerenv");
  const envTarget = process.env.VITE_API_URL;
  const target = envTarget || (isDocker ? "http://backend:8001" : "http://localhost:8001");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: target,
          changeOrigin: true,
        },
        "/uploads": {
          target: target,
          changeOrigin: true,
        },
      },
    },
  };
});
