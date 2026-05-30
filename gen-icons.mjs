import sharp from 'sharp'
import { mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, 'public', 'icons')

mkdirSync(outDir, { recursive: true })

const svg = Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='512' height='512' viewBox='0 0 512 512'>
  <rect width='512' height='512' rx='90' fill='#0a0a14'/>
  <polygon points='310,40 175,275 265,275 205,472 345,225 250,225' fill='#a78bfa'/>
</svg>`)

await Promise.all([
  sharp(svg).resize(192, 192).png().toFile(join(outDir, 'icon-192.png')),
  sharp(svg).resize(512, 512).png().toFile(join(outDir, 'icon-512.png')),
])
console.log('Icons generated in public/icons/')
