import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["swagger-ui-react"],
  },
  build: {
    // Disable source maps in production to reduce memory (Amplify 16GB build often OOMs with 5k+ modules)
    sourcemap: false,
    commonjsOptions: {
      include: [/swagger-ui-react/, /node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      // Limit parallel file ops to lower peak memory during build (helps on 16GB Amplify instances)
      maxParallelFileOps: 4,
      onwarn(warning, warn) {
        // Suppress certain warnings from swagger-ui-react
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
          return;
        }
        warn(warning);
      },
    },
  },
}));
