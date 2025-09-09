import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mimeTypes from 'mime-types';

export class ImageUtils {
  private static readonly SUPPORTED_FORMATS = [
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
    'image/webp', 'image/avif', 'image/bmp', 'image/tiff'
  ];

  static async loadImage(source: string): Promise<Buffer> {
    // URL图片
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return await this.loadFromUrl(source);
    }
    
    // Base64图片
    if (source.startsWith('data:image/')) {
      return this.loadFromBase64(source);
    }
    
    // 本地文件
    return await this.loadFromFile(source);
  }

  private static async loadFromUrl(url: string): Promise<Buffer> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Image-Processor-MCP/1.0'
        }
      });

      const contentType = response.headers['content-type'];
      if (!this.SUPPORTED_FORMATS.includes(contentType)) {
        throw new Error(`Unsupported image format: ${contentType}`);
      }

      return Buffer.from(response.data);
    } catch (error) {
      throw new Error(`Failed to load image from URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static loadFromBase64(dataUrl: string): Buffer {
    try {
      const matches = dataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid base64 data URL format');
      }

      const [, format, base64Data] = matches;
      const mimeType = `image/${format}`;
      
      if (!this.SUPPORTED_FORMATS.includes(mimeType)) {
        throw new Error(`Unsupported image format: ${mimeType}`);
      }

      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      throw new Error(`Failed to load image from base64: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static async loadFromFile(filePath: string): Promise<Buffer> {
    try {
      const buffer = await fs.readFile(filePath);
      
      // 验证文件类型
      const mimeType = mimeTypes.lookup(filePath);
      if (!mimeType || !this.SUPPORTED_FORMATS.includes(mimeType)) {
        throw new Error(`Unsupported file format: ${path.extname(filePath)}`);
      }

      return buffer;
    } catch (error) {
      throw new Error(`Failed to load image from file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async saveBuffer(
    buffer: Buffer, 
    format: string, 
    outputDir: string = './output',
    customPath?: string
  ): Promise<string> {
    try {
      let filePath: string;
      
      if (customPath) {
        // 用户指定了完整路径
        filePath = customPath;
        // 确保文件扩展名正确
        if (!filePath.toLowerCase().endsWith(`.${format.toLowerCase()}`)) {
          filePath += `.${format}`;
        }
        // 确保目录存在
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
      } else {
        // 使用默认目录和随机文件名
        await fs.mkdir(outputDir, { recursive: true });
        const filename = `${uuidv4()}.${format}`;
        filePath = path.join(outputDir, filename);
      }

      await fs.writeFile(filePath, buffer);
      
      // 返回绝对路径，方便用户找到文件
      const absolutePath = path.resolve(filePath);
      return absolutePath;
    } catch (error) {
      throw new Error(`Failed to save image: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static getImageInfo(buffer: Buffer): { size: number; type?: string } {
    const size = buffer.length;
    let type: string | undefined;

    // 简单的文件类型检测
    if (buffer.length >= 4) {
      const header = buffer.subarray(0, 4);
      
      if (header[0] === 0xFF && header[1] === 0xD8) {
        type = 'jpeg';
      } else if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        type = 'png';
      } else if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
        type = 'gif';
      } else if (buffer.subarray(8, 12).toString() === 'WEBP') {
        type = 'webp';
      }
    }

    return { size, type };
  }

  static validateImageBuffer(buffer: Buffer): boolean {
    if (!buffer || buffer.length === 0) {
      return false;
    }

    const info = this.getImageInfo(buffer);
    return info.type !== undefined;
  }

  static async downloadWithRetry(url: string, maxRetries: number = 3): Promise<Buffer> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.loadFromUrl(url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // 指数退避
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Failed to download after ${maxRetries} attempts: ${lastError!.message}`);
  }

  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  static calculateAspectRatio(width: number, height: number): { ratio: number; description: string } {
    const ratio = width / height;
    
    let description: string;
    if (Math.abs(ratio - 1) < 0.1) {
      description = 'Square (1:1)';
    } else if (Math.abs(ratio - 4/3) < 0.1) {
      description = 'Standard (4:3)';
    } else if (Math.abs(ratio - 16/9) < 0.1) {
      description = 'Widescreen (16:9)';
    } else if (Math.abs(ratio - 3/2) < 0.1) {
      description = 'Classic (3:2)';
    } else if (ratio > 2) {
      description = 'Ultra-wide';
    } else if (ratio < 0.5) {
      description = 'Ultra-tall';
    } else if (ratio > 1) {
      description = 'Landscape';
    } else {
      description = 'Portrait';
    }

    return {
      ratio: Math.round(ratio * 100) / 100,
      description
    };
  }
}