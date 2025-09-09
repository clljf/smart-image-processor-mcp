import { Logger } from '../utils/Logger.js';
import { ImageAnalyzer } from './ImageAnalyzer.js';
import { ImageCompressor } from './ImageCompressor.js';
import { FormatConverter } from './FormatConverter.js';
import { ColorExtractor } from './ColorExtractor.js';

export interface BatchResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  results: Array<{
    source: string;
    success: boolean;
    result?: any;
    error?: string;
    processingTime: number;
  }>;
  summary: {
    totalTime: number;
    averageTime: number;
    successRate: number;
  };
}

export class BatchProcessor {
  private imageAnalyzer: ImageAnalyzer;
  private imageCompressor: ImageCompressor;
  private formatConverter: FormatConverter;
  private colorExtractor: ColorExtractor;

  constructor(private logger: Logger) {
    this.imageAnalyzer = new ImageAnalyzer(logger);
    this.imageCompressor = new ImageCompressor(logger);
    this.formatConverter = new FormatConverter(logger);
    this.colorExtractor = new ColorExtractor(logger);
  }

  async process(
    sources: string[], 
    operation: string, 
    options: any = {}, 
    concurrency: number = 3
  ): Promise<BatchResult> {
    this.logger.info('Starting batch processing', {
      operation,
      totalImages: sources.length,
      concurrency
    });

    const startTime = Date.now();
    const results: BatchResult['results'] = [];
    
    // 分批处理以控制并发
    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(source => this.processSingle(source, operation, options));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const source = batch[index];
        if (result.status === 'fulfilled') {
          results.push({
            source,
            success: true,
            result: result.value.result,
            processingTime: result.value.processingTime
          });
        } else {
          results.push({
            source,
            success: false,
            error: result.reason?.message || 'Unknown error',
            processingTime: 0
          });
        }
      });

      // 批次间短暂延迟，避免过载
      if (i + concurrency < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const averageTime = successful > 0 
      ? results.filter(r => r.success).reduce((sum, r) => sum + r.processingTime, 0) / successful 
      : 0;

    const batchResult: BatchResult = {
      totalProcessed: results.length,
      successful,
      failed,
      results,
      summary: {
        totalTime,
        averageTime: Math.round(averageTime),
        successRate: Math.round((successful / results.length) * 100)
      }
    };

    this.logger.info('Batch processing completed', {
      totalProcessed: batchResult.totalProcessed,
      successful: batchResult.successful,
      failed: batchResult.failed,
      successRate: `${batchResult.summary.successRate}%`,
      totalTime: `${totalTime}ms`
    });

    return batchResult;
  }

  private async processSingle(source: string, operation: string, options: any) {
    const startTime = Date.now();
    
    try {
      let result: any;

      switch (operation) {
        case 'analyze':
          result = await this.imageAnalyzer.analyze(source, options);
          break;
        case 'compress':
          result = await this.imageCompressor.compress(source, options);
          break;
        case 'convert':
          if (!options.targetFormat) {
            throw new Error('targetFormat is required for convert operation');
          }
          result = await this.formatConverter.convert(source, options.targetFormat, options);
          break;
        case 'extract_colors':
          result = await this.colorExtractor.extract(source, options);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const processingTime = Date.now() - startTime;
      return { result, processingTime };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.warn(`Failed to process ${source}:`, error);
      throw error;
    }
  }

  async processWithProgress(
    sources: string[],
    operation: string,
    options: any = {},
    concurrency: number = 3,
    onProgress?: (progress: { completed: number; total: number; percentage: number }) => void
  ): Promise<BatchResult> {
    this.logger.info('Starting batch processing with progress tracking');

    const startTime = Date.now();
    const results: BatchResult['results'] = [];
    let completed = 0;

    for (let i = 0; i < sources.length; i += concurrency) {
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(async (source) => {
        try {
          const singleResult = await this.processSingle(source, operation, options);
          completed++;
          
          if (onProgress) {
            onProgress({
              completed,
              total: sources.length,
              percentage: Math.round((completed / sources.length) * 100)
            });
          }

          return {
            source,
            success: true,
            result: singleResult.result,
            processingTime: singleResult.processingTime
          };
        } catch (error) {
          completed++;
          
          if (onProgress) {
            onProgress({
              completed,
              total: sources.length,
              percentage: Math.round((completed / sources.length) * 100)
            });
          }

          return {
            source,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTime: 0
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次间延迟
      if (i + concurrency < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const totalTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const averageTime = successful > 0 
      ? results.filter(r => r.success).reduce((sum, r) => sum + r.processingTime, 0) / successful 
      : 0;

    return {
      totalProcessed: results.length,
      successful,
      failed,
      results,
      summary: {
        totalTime,
        averageTime: Math.round(averageTime),
        successRate: Math.round((successful / results.length) * 100)
      }
    };
  }

  async validateSources(sources: string[]): Promise<{ valid: string[]; invalid: string[] }> {
    this.logger.info('Validating batch sources', { count: sources.length });

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const source of sources) {
      try {
        // 简单验证：检查是否为有效的URL、base64或文件路径
        if (this.isValidSource(source)) {
          valid.push(source);
        } else {
          invalid.push(source);
        }
      } catch (error) {
        invalid.push(source);
      }
    }

    this.logger.info('Source validation completed', {
      valid: valid.length,
      invalid: invalid.length
    });

    return { valid, invalid };
  }

  private isValidSource(source: string): boolean {
    // URL检查
    if (source.startsWith('http://') || source.startsWith('https://')) {
      try {
        new URL(source);
        return true;
      } catch {
        return false;
      }
    }

    // Base64检查
    if (source.startsWith('data:image/')) {
      return true;
    }

    // 文件路径检查（简单验证）
    if (source.includes('.') && /\.(jpg|jpeg|png|gif|bmp|webp|avif|tiff)$/i.test(source)) {
      return true;
    }

    return false;
  }
}