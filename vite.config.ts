import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: '/recepciones_app/', // 👈 obligatorio para GitHub Pages
  plugins: [react()],
})
