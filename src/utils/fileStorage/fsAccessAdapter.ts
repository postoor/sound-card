import type { StorageAdapter } from './index'

// Minimal local typings for the File System Access API, which may not be
// present in all lib.dom versions.
interface FsWritableFileStreamLike {
  write(data: Blob): Promise<void>
  close(): Promise<void>
}
interface FsFileHandleLike {
  createWritable(): Promise<FsWritableFileStreamLike>
}
interface FsDirectoryHandleLike {
  readonly name: string
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsFileHandleLike>
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FsDirectoryHandleLike>
}
type ShowDirectoryPicker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<FsDirectoryHandleLike>

export class FsAccessAdapter implements StorageAdapter {
  readonly supportsDirectoryPicker = true
  private dirHandle: FsDirectoryHandleLike | null = null

  async pickDirectory(): Promise<void> {
    const picker = (window as unknown as { showDirectoryPicker: ShowDirectoryPicker }).showDirectoryPicker
    this.dirHandle = await picker({ mode: 'readwrite' })
  }

  hasDirectory(): boolean {
    return this.dirHandle !== null
  }

  getDirectoryName(): string | null {
    return this.dirHandle?.name ?? null
  }

  private async resolveDir(subdir?: string): Promise<FsDirectoryHandleLike> {
    if (!this.dirHandle) throw new Error('尚未選擇資料夾')
    if (!subdir) return this.dirHandle
    return this.dirHandle.getDirectoryHandle(subdir, { create: true })
  }

  async saveFile(filename: string, blob: Blob, subdir?: string): Promise<void> {
    const dir = await this.resolveDir(subdir)
    const handle = await dir.getFileHandle(filename, { create: true })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
  }

  async saveJson(filename: string, data: unknown, subdir?: string): Promise<void> {
    await this.saveFile(filename, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), subdir)
  }
}
