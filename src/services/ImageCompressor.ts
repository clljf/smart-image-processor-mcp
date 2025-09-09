import sharp from 'sharp';
import { Logger } from '../utils/Logger.js';
import { ImageUtils } from '../utils/ImageUtils.js';

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
  quality: number;
  data?: string; // base64 or file path
  buffer?: Buffer;
  metadata: {
    width: number;
    height: number;
    algorithm: string;
  };
}

export class ImageCompressor {
  constructor(private logger: Logger) {}

  async compress(source: string, options: any = {}): Promise<CompressionResult> {
    this.logger.info('Starting image compression', { 
      algorithm: options.algorithm || 'mozjpeg',
      quality: options.quality || 80 
    });

    try {
      const originalBuffer = await ImageUtils.loadImage(source);
      const originalSize = originalBuffer.length;

      let compressedBuffer: Buffer;
      let format: string;
      
      const image = sharp(originalBuffer);
      const metadata = await image.metadata();

      // 应用尺寸限制
      if (options.maxWidth || options.maxHeight) {
        image.resize(options.maxWidth, options.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // 根据算法进行压缩
      switch (options.algorithm) {
        case 'webp':
          compressedBuffer = await image
            .webp({ quality: options.quality || 80 })
            .toBuffer();
          format = 'webp';
          break;
          
        case 'avif':
          compressedBuffer = await image
            .avif({ quality: options.quality || 80 })
            .toBuffer();
          format = 'avif';
          break;
          
        case 'mozjpeg':
        default:
          compressedBuffer = await image
            .jpeg({ 
              quality: options.quality || 80,
              mozjpeg: true,
              progressive: true
            })
            .toBuffer();
          format = 'jpeg';
          break;
      }

      const compressedSize = compressedBuffer.length;
      const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

      const result: CompressionResult = {
        originalSize,
        compressedSize,
        compressionRatio,
        format,
        quality: options.quality || 80,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          algorithm: options.algorithm || 'mozjpeg'
        }
      };

      // 根据输出格式处理结果
      switch (options.outputFormat) {
        case 'buffer':
          result.buffer = compressedBuffer;
          break;
        case 'file':
          const outputPath = await ImageUtils.saveBuffer(
            compressedBuffer, 
            format, 
            options.outputDir,
            options.outputPath
          );
          result.data = outputPath;
          break;
        case 'base64':
        default:
          result.data = `data:image/${format};base64,${compressedBuffer.toString('base64')}`;
          break;
      }

      this.logger.info('Image compression completed', {
        originalSize,
        compressedSize,
        compressionRatio: `${compressionRatio}%`
      });

      return result;

    } catch (error) {
      this.logger.error('Image compression failed:', error);
      throw new Error(`Image compression failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async optimizeForWeb(source: string, targetSize?: number): Promise<CompressionResult> {
    this.logger.info('Optimizing image for web', { targetSize });

    const originalBuffer = await ImageUtils.loadImage(source);
    const originalSize = originalBuffer.length;

    if (!targetSize) {
      targetSize = Math.min(originalSize * 0.7, 500 * 1024); // 默认目标：原图70%或500KB
    }

    let quality = 90;
    let result: CompressionResult;

    // 二分法寻找最佳质量
    let minQuality = 10;
    let maxQuality = 90;

    while (minQuality <= maxQuality) {
      quality = Math.floor((minQuality + maxQuality) / 2);
      
      result = await this.compress(source, {
        algorithm: 'webp',
        quality,
        outputFormat: 'buffer'
      });

      if (result.compressedSize <= targetSize) {
        minQuality = quality + 1;
      } else {
        maxQuality = quality - 1;
      }
    }

    // 使用找到的最佳质量重新压缩并返回base64
    return await this.compress(source, {
      algorithm: 'webp',
      quality: maxQuality,
      outputFormat: 'base64'
    });
  }
}