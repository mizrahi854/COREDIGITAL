import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" keeps every asset path relative so the build also works from a sub-path or file host.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
});
