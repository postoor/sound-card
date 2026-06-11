import { FsAccessAdapter } from './fsAccessAdapter'
import { DownloadAdapter } from './downloadAdapter'

export interface StorageAdapter {
  readonly supportsDirectoryPicker: boolean
  pickDirectory(): Promise<void>
  hasDirectory(): boolean
  getDirectoryName(): string | null
  saveFile(filename: string, blob: Blob, subdir?: string): Promise<void>
  saveJson(filename: string, data: unknown, subdir?: string): Promise<void>
}

let instance: StorageAdapter | null = null

/** Returns a shared adapter instance so a directory picked in one view stays selected app-wide. */
export function createStorageAdapter(): StorageAdapter {
  if (!instance) {
    instance = typeof window !== 'undefined' && 'showDirectoryPicker' in window
      ? new FsAccessAdapter()
      : new DownloadAdapter()
  }
  return instance
}
