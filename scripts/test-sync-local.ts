import { fileURLToPath } from 'node:url'
import { localConfig } from '../test/sync-local/protocol'

// Fails early, with the hint, when no stack is running.
localConfig()
const child = Bun.spawn([process.execPath, 'test', '--timeout', '30000', './test/sync-local/sync.test.ts'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, NOUTUBE_SYNC_LOCAL: '1' },
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
})
process.exit(await child.exited)
