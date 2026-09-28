import { build } from 'vite'

const VARIANTS = Object.freeze({
  tetris: {
    enabled: true,
    outDir: 'dist-tetris',
  },
  standard: {
    enabled: false,
    outDir: 'dist-standard',
  },
})

const variantName = String(process.argv[2] || '').trim().toLowerCase()
const variant = VARIANTS[variantName]

if (!variant) {
  throw new Error(`Unknown PWA build variant: ${variantName || '(empty)'}`)
}

process.env.VITE_ENABLE_TETRIS_LANDING = String(variant.enabled)

await build({
  mode: 'production',
  build: {
    outDir: variant.outDir,
    emptyOutDir: true,
  },
})
