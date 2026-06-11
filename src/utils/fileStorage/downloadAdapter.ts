import type { StorageAdapter } from './index'

/** Fallback for browsers without the File System Access API (Firefox/Safari). */
export class DownloadAdapter implements StorageAdapter {
  readonly supportsDirectoryPicker = false

  async pickDirectory(): Promise<void> {
    // No directory concept; downloads go to the browser's default location.
  }

  hasDirectory(): boolean {
    return true
  }

  getDirectoryName(): string | null {
    return null
  }

  async saveFile(filename: string, blob: Blob): Promise<void> {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async saveJson(filename: string, data: unknown): Promise<void> {
    await this.saveFile(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  }
}
