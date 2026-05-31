import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@3dm/shared-contracts': root + '../../packages/shared-contracts/src/index.ts',
      '@3dm/event-bus': root + '../../packages/event-bus/src/index.ts',
      '@3dm/project-manager': root + '../project-manager/src/index.ts',
      '@3dm/editor-2d': root + '../editor-2d/src/index.ts',
      '@3dm/editor-3d': root + '../editor-3d/src/index.ts',
      '@3dm/viewer-3d': root + '../viewer-3d/src/index.ts',
      '@3dm/export': root + '../export/src/index.ts',
    },
  },
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: ['fabric', 'three'],
  },
})
