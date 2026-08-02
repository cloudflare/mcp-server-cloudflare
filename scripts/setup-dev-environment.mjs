import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const templatePath = path.join(root, '.env.development.local.example')
const targetPath = path.join(root, '.env.development.local')

if (!fs.existsSync(templatePath)) {
	console.error(`Template missing at ${templatePath}`)
	process.exit(1)
}

if (fs.existsSync(targetPath)) {
	console.log('✅ .env.development.local already exists')
	process.exit(0)
}

fs.copyFileSync(templatePath, targetPath)
console.log('✅ Created .env.development.local from template')
console.log('Edit .env.development.local with your local credentials before running pnpm dev.')
