import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { gzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const entrySizeReport: Plugin = {
  name: "entry-size-report",
  apply: "build",
  generateBundle(_options, bundle) {
    const entries = Object.values(bundle).flatMap(item => item.type === "chunk" && item.isEntry
      ? [{ file: item.fileName, bytes: Buffer.byteLength(item.code), gzip_bytes: gzipSync(item.code).length, imports: item.imports }]
      : []);
    writeFileSync("/tmp/batch4-size-after.json", JSON.stringify(entries));
    console.info("Entry size report:", JSON.stringify(entries));
  },
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), entrySizeReport].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
