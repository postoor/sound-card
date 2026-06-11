import { FsAccessAdapter } from './fsAccessAdapter'
import { DownloadAdapter } from './downloadAdapter'

export interface StorageAdapter {
  readonly supportsDirectoryPicker: boolean
  pickDirectory(): Promise<void>
  hasDirectory(): boolean
  saveFile(filename: string, blob: Blob): Promise<void>
  saveJson(filename: string, data: unknown): Promise<void>
}

export function createStorageAdapter(): StorageAdapter {
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    return new FsAccessAdapter()
  }
  return new DownloadAdapter()
}
