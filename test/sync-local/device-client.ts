import type { Subprocess } from 'bun'
import type { Command, Snapshot } from './protocol'

export class Device {
  private child!: Subprocess
  private nextId = 0
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>()

  static async start(email: string, password: string) {
    const device = new Device()
    let ready!: () => void
    let failed!: (error: Error) => void
    const started = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject })
    device.child = Bun.spawn([process.execPath, new URL('./device.ts', import.meta.url).pathname], {
      cwd: new URL('../..', import.meta.url).pathname,
      env: { ...process.env, NOUTUBE_SYNC_EMAIL: email, NOUTUBE_SYNC_PASSWORD: password },
      stdout: 'inherit', stderr: 'inherit',
      ipc(message: { ready?: boolean; id: number; value?: unknown; error?: string }) {
        if (message.ready) return ready()
        const pending = device.pending.get(message.id)
        device.pending.delete(message.id)
        if (message.error) pending?.reject(new Error(message.error))
        else pending?.resolve(message.value)
      },
      onExit(_child, code) {
        const error = new Error(`Sync device exited (${code})`)
        failed(error)
        for (const pending of device.pending.values()) pending.reject(error)
        device.pending.clear()
      },
    })
    // Ensure a failed startup cannot leave a process running after a hook times out.
    const timeout = setTimeout(() => device.child.kill(), 20_000)
    try { await started } finally { clearTimeout(timeout) }
    return device
  }

  command(command: Command): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.child.send({ id, command })
    })
  }

  snapshot() { return this.command({ op: 'snapshot' }) as Promise<Snapshot> }
  sync(scope?: Extract<Command, { op: 'sync' }>['scope']) { return this.command({ op: 'sync', scope }) }
  async close() { this.child.kill(); await this.child.exited }
}
