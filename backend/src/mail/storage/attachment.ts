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
    const filePath = path.join(this.baseDir, id);
    fs.writeFileSync(filePath, data);
    return { id, filename, contentType, size: data.length, path: filePath };
  }

  read(id: string): Buffer | null {
    const filePath = path.join(this.baseDir, id);
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  }

  delete(id: string): void {
    const filePath = path.join(this.baseDir, id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export const attachmentStore = new AttachmentStore();
