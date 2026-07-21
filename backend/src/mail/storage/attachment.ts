import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { config } from '../../config/config';

export interface StoredAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  path: string;
}

export class AttachmentStore {
  private baseDir: string;

  constructor(baseDir = path.join(config.mailDir, 'attachments')) {
    this.baseDir = baseDir;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  save(filename: string, contentType: string, data: Buffer): StoredAttachment {
    this.ensureDir();
    const id = randomUUID();
    // Dateiname nur Metadaten — Pfadkomponenten entfernen (kein Traversal).
    const safeName = path.basename(filename.replace(/\\/g, '/')).slice(0, 255) || 'attachment';
    const filePath = path.join(this.baseDir, id);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(this.baseDir) + path.sep)) {
      throw new Error('Invalid attachment path');
    }
    fs.writeFileSync(resolved, data);
    return { id, filename: safeName, contentType, size: data.length, path: resolved };
  }

  read(id: string): Buffer | null {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    const filePath = path.join(this.baseDir, id);
    const resolved = path.resolve(filePath);
    const base = path.resolve(this.baseDir);
    if (!resolved.startsWith(base + path.sep)) return null;
    if (!fs.existsSync(resolved)) return null;
    return fs.readFileSync(resolved);
  }

  delete(id: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return;
    }
    const filePath = path.join(this.baseDir, id);
    const resolved = path.resolve(filePath);
    const base = path.resolve(this.baseDir);
    if (!resolved.startsWith(base + path.sep)) return;
    if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
  }
}

export const attachmentStore = new AttachmentStore();
