import sharp from 'sharp';
import { Logger } from '../utils/Logger.js';
import { ImageUtils } from '../utils/ImageUtils.js';

export interface ConversionResult {
  originalFormat: string;
  targetFormat: string;
  originalSize: number;
  convertedSize: number;
  data?: string; // base64 or file path
  buffer?: Buffer;
  metadata: {
    width: number;
    height: number;
    quality: number;
    progressive?: boolean;
  };
}

export class FormatConverter {
  constructor(private logger: Logger) {}

  async convert(source: string, targetFormat: string, options: any = {}): Promise<ConversionResult> {
    this.logger.info('Starting format conversion', { 
      targetFormat,
      quality: options.quality || 90 
    });

    try {
      const originalBuffer = await ImageUtils.loadImage(source);
      const originalSize = originalBuffer.length;

      const image = sharp(originalBuffer);
      const metadata = await image.metadata();
      const originalFormat = metadata.format || 'unknown';

      let convertedBuffer: Buffer;
      const quality = options.quality || 90;
      const progressive = options.progressive || false;

      // 根据目标格式进行转换
      switch (targetFormat.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
          convertedBuffer = await image
            .jpeg({ 
              quality,
              progressive,
              mozjpeg: true
            })
            .toBuffer();
          break;

        case 'png':
          convertedBuffer = await image
            .png({ 
              quality,
              progressive,
              compressionLevel: 9
            })
            .toBuffer();
          break;

        case 'webp':
          convertedBuffer = await image
            .webp({ 
              quality,
              lossless: quality === 100
            })
            .toBuffer();
          break;

        case 'avif':
          convertedBuffer = await image
            .avif({ 
              quality,
              lossless: quality === 100
            })
            .toBuffer();
          break;

        case 'gif':
          convertedBuffer = await image
            .gif()
            .toBuffer();
          break;

        case 'bmp':
          // Sharp doesn't support BMP output, convert to PNG instead
          convertedBuffer = await image
            .png()
            .toBuffer();
          break;

        case 'tiff':
          convertedBuffer = await image
            .tiff({ 
              quality,
              compression: 'lzw'
            })
            .toBuffer();
          break;

        default:
          throw new Error(`Unsupported target format: ${targetFormat}`);
      }

      const convertedSize = convertedBuffer.length;

      const result: ConversionResult = {
        originalFormat,
        targetFormat,
        originalSize,
        convertedSize,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          quality,
          progressive
        }
      };

      // 根据输出格式处理结果
      switch (options.outputFormat) {
        case 'buffer':
          result.buffer = convertedBuffer;
          break;
        case 'file':
          const outputPath = await ImageUtils.saveBuffer(
            convertedBuffer, 
            targetFormat, 
            options.outputDir,
            options.outputPath
          );
          result.data = outputPath;
          break;
        case 'base64':
        default:
          result.data = `data:image/${targetFormat};base64,${convertedBuffer.toString('base64')}`;
          break;
      }

      this.logger.info('Format conversion completed', {
        originalFormat,
        targetFormat,
        originalSize,
        convertedSize,
        sizeChange: `${convertedSize > originalSize ? '+' : ''}${Math.round((convertedSize - originalSize) / originalSize * 100)}%`
      });

      return result;

    } catch (error) {
      this.logger.error('Format conversion failed:', error);
      throw new Error(`Format conversion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async convertToModernFormat(source: string, options: any = {}): Promise<ConversionResult> {
    this.logger.info('Converting to modern format');

    const originalBuffer = await ImageUtils.loadImage(source);
    const image = sharp(originalBuffer);
    const metadata = await image.metadata();

    // 根据图片特性选择最佳现代格式
    let targetFormat: string;
    let quality = options.quality || 85;

    if (metadata.hasAlpha) {
      // 有透明通道，优先使用WebP
      targetFormat = 'webp';
    } else if ((metadata.width || 0) * (metadata.height || 0) > 1000000) {
      // 大图片，使用AVIF获得更好压缩
      targetFormat = 'avif';
      quality = Math.min(quality, 75); // AVIF在较低质量下仍有好效果
    } else {
      // 普通图片，使用WebP
      targetFormat = 'webp';
    }

    return await this.convert(source, targetFormat, { ...options, quality });
  }

  async createResponsiveVersions(source: string, sizes: number[] = [480, 768, 1024, 1920]): Promise<ConversionResult[]> {
    this.logger.info('Creating responsive versions', { sizes });

    const results: ConversionResult[] = [];
    
    for (const width of sizes) {
      try {
        const originalBuffer = await ImageUtils.loadImage(source);
        const resizedBuffer = await sharp(originalBuffer)
          .resize(width, null, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .webp({ quality: 85 })
          .toBuffer();

        const result = await this.convert(
          `data:image/webp;base64,${resizedBuffer.toString('base64')}`,
          'webp',
          { quality: 85, outputFormat: 'base64' }
        );

        results.push({
          ...result,
          metadata: {
            ...result.metadata,
            width
          }
        });
      } catch (error) {
        this.logger.warn(`Failed to create ${width}px version:`, error);
      }
    }

    return results;
  }
}