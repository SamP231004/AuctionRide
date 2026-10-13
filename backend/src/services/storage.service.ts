import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS } from '../config/constants.js';
import type { StorageProvider } from '../types/ports.js';

/**
 * Stores files on local disk and serves them from /uploads. Suitable for development and
 * single-instance deployments; production should implement StorageProvider over S3/R2.
 */
export class LocalStorageProvider implements StorageProvider {
  constructor(
    private readonly directory: string,
    private readonly publicBaseUrl: string,
  ) {}

  async save(file: { buffer: Buffer; extension: string }): Promise<{ key: string; url: string }> {
    await mkdir(this.directory, { recursive: true });
    // Server-generated names only: user input never reaches the filesystem path.
    const key = `${randomUUID()}.${file.extension}`;
    await writeFile(path.join(this.directory, key), file.buffer);
    return { key, url: `${this.publicBaseUrl}${UPLOADS.PUBLIC_PATH}/${key}` };
  }

  async delete(key: string): Promise<void> {
    if (!/^[\w-]+\.(jpg|png|webp)$/.test(key)) return;
    await rm(path.join(this.directory, key), { force: true });
  }
}

/** Detects the real image type from magic bytes rather than trusting the client's Content-Type. */
export function detectImageType(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  return null;
}
