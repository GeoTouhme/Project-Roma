import { defineConfig, loadEnv } from 'vite';
import { transform } from 'esbuild';
import { fileURLToPath } from 'node:url';
const sourceRoot = fileURLToPath(new URL('./src/', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'REACT_APP_'), ...process.env };
  const publicKeys = ['REACT_APP_API_URL', 'REACT_APP_GOOGLE_CLIENT_ID', 'REACT_APP_STRIPE_PUBLIC_KEY',
    'REACT_APP_GOOGLE_MAPS_KEY', 'REACT_APP_MAINTENANCE_MODE', 'REACT_APP_ORDERING_DISABLED', 'REACT_APP_IMAGE_FALLBACK_URL'];
  return {
    plugins: [{ name: 'legacy-jsx-source', enforce: 'pre', async transform(code, id) {
      if (id.startsWith(sourceRoot) && id.endsWith('.js')) return transform(code, { loader:'jsx', jsx:'automatic', format:'esm', sourcemap:true, sourcefile:id });
    } }],
    esbuild: { jsx: 'automatic' },
    define: Object.fromEntries([
      ...publicKeys.map(key => [`process.env.${key}`, JSON.stringify(env[key] || '')]),
      ['process.env.NODE_ENV', JSON.stringify(mode)],
    ]),
    build: { outDir:'build', sourcemap:false, assetsDir:'static', manifest:true },
    server: { host:'127.0.0.1', proxy: { '/api':'http://localhost:5001', '/socket.io': { target:'http://localhost:5001', ws:true } } },
  };
});
