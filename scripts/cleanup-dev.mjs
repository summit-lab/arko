#!/usr/bin/env node
/**
 * Kills any stale process on port 3000 and removes the Next.js dev lock file.
 * Runs automatically via the "predev" npm script before `next dev`.
 */

import { execSync } from 'node:child_process'
import { rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const lockFile = join(__dirname, '..', '.next', 'dev', 'lock')

if (existsSync(lockFile)) {
  rmSync(lockFile, { force: true })
  console.log('✓ Removed stale .next/dev/lock')
}

try {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    const listening = out.split('\n').filter(l => l.includes(':3000 ') && l.includes('LISTENING'))
    for (const line of listening) {
      const pid = line.trim().split(/\s+/).at(-1)
      if (pid && /^\d+$/.test(pid) && pid !== '0') {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
          console.log(`✓ Killed stale process PID ${pid} on :3000`)
        } catch { /* already gone */ }
      }
    }
  } else {
    execSync("lsof -ti :3000 | xargs kill -9 2>/dev/null || true", { shell: true, stdio: 'ignore' })
  }
} catch { /* no process on port, all good */ }
