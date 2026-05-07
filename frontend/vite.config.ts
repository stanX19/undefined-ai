import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "fs";

export default defineConfig(() => {
  const isDocker = fs.existsSync("/.dockerenv");
  const envTargetRaw = process.env.VITE_API_URL;
  const envTarget = envTargetRaw?.endsWith("/") ? envTargetRaw.slice(0, -1) : envTargetRaw;
  const envLooksLocalhost = !!envTarget && (envTarget.includes("localhost") || envTarget.includes("127.0.0.1"));
  const target = isDocker && envLooksLocalhost
    ? "http://backend:8001"
    : (envTarget || (isDocker ? "http://backend:8001" : "http://localhost:8001"));

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
