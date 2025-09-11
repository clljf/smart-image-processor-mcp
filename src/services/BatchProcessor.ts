import { Logger } from '../utils/Logger.js';
import { ImageAnalyzer } from './ImageAnalyzer.js';
import { ImageCompressor } from './ImageCompressor.js';
import { FormatConverter } from './FormatConverter.js';
import { ColorExtractor } from './ColorExtractor.js';

/**
 * 批处理结果结构
 * - results: 每张图片的处理状态与耗时
 * - summary: 总体统计（总耗时、平均耗时、成功率）
 */
export interface BatchResult {
  /** 实际处理的总数量（等于 sources.length） */
  totalProcessed: number;
  /** 成功数量 */
  successful: number;
  /** 失败数量 */
  failed: number;
  /** 每项结果明细 */
  results: Array<{
    /** 原始输入来源（URL/Base64/文件路径） */
    source: string;
    /** 是否处理成功 */
    success: boolean;
    /** 成功时的返回结果（由各服务定义） */
    result?: any;
    /** 失败时的错误信息（已提取 message） */
    error?: string;
    /** 单项处理耗时（毫秒） */
    processingTime: number;
  }>;
  /** 总体统计汇总 */
  summary: {
    /** 本次批处理总耗时（毫秒） */
    totalTime: number;
    /** 成功项的平均耗时（四舍五入） */
    averageTime: number;
    /** 成功率（百分比整数，如 87 表示 87%） */
    successRate: number;
  };
}

/**
 * BatchProcessor
 * - 负责协调底层图片服务（分析/压缩/转换/颜色提取）
 * - 提供并发控制、进度回调、统计聚合与基础输入校验
 */
export class BatchProcessor {
  private imageAnalyzer: ImageAnalyzer;
  private imageCompressor: ImageCompressor;
  private formatConverter: FormatConverter;
  private colorExtractor: ColorExtractor;

  /**
   * @param logger 日志记录器，用于输出阶段性日志与告警
   */
  constructor(private logger: Logger) {
    this.imageAnalyzer = new ImageAnalyzer(logger);
    this.imageCompressor = new ImageCompressor(logger);
    this.formatConverter = new FormatConverter(logger);
    this.colorExtractor = new ColorExtractor(logger);
  }

  /**
   * 批量处理（无实时回调）
   * - 按 concurrency 将 sources 切片并发执行，批次之间短暂延迟以防过载
   * @param sources 图片来源数组（URL/Base64/文件路径）
   * @param operation 操作类型：'analyze' | 'compress' | 'convert' | 'extract_colors'
   * @param options 透传给各服务的参数；当 operation='convert' 时需要提供 targetFormat
   * @param concurrency 并发数（默认 3），过大可能导致内存或网络压力
   * @returns 批处理结果与统计
   */
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
      // 使用切片窗口控制每一批的并发量
      const batch = sources.slice(i, i + concurrency);
      const batchPromises = batch.map(source => this.processSingle(source, operation, options));
      
      // 使用 Promise.allSettled 确保单项失败不影响整批完成
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
        // 批次间短暂停顿，降低峰值压力（网络/CPU）
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

  /**
   * 处理单个来源
   * - 根据 operation 路由到对应服务
   * - convert 需要 options.targetFormat，否则抛错
   * @throws 透传底层服务抛出的异常，供上层统计与记录
   */
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
      // 仅记录告警与错误信息，错误向上抛出，交由批量流程统计
      this.logger.warn(`Failed to process ${source}:`, error);
      throw error;
    }
  }

  /**
   * 批量处理（带进度回调）
   * - 在每项完成后更新 completed 并回调 onProgress
   * - 与 process 的差异：每个 batch 内部使用 try/catch 返回结构化结果
   * @param onProgress 回调参数：completed/total/percentage（整数百分比）
   */
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

      // 此处使用 Promise.all：batchPromises 内部已自行捕获错误并返回结构化结果
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 批次间延迟
      if (i + concurrency < sources.length) {
        // 批次间延迟，避免峰值压力
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

  /**
   * 对输入来源进行基础校验（轻量级）
   * - 规则：URL(含协议且可被 URL 构造解析) / data:image/* Base64 / 常见图片扩展名
   * - 注意：不做 I/O 存在性检查，仅判定“看起来像”合法来源
   */
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

  /**
   * 轻量来源校验，不访问网络/磁盘
   */
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