#!/usr/bin/env node

// 导入MCP SDK的核心组件
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,    // 工具调用请求的JSON Schema
  ErrorCode,               // MCP标准错误码
  ListToolsRequestSchema,  // 工具列表请求的JSON Schema
  McpError,               // MCP标准错误类
} from '@modelcontextprotocol/sdk/types.js';

// 导入图片处理相关的服务类
import { ImageAnalyzer } from './services/ImageAnalyzer.js';      // 图片分析服务
import { ImageCompressor } from './services/ImageCompressor.js';  // 图片压缩服务
import { FormatConverter } from './services/FormatConverter.js';  // 格式转换服务
import { ColorExtractor } from './services/ColorExtractor.js';    // 颜色提取服务
import { BatchProcessor } from './services/BatchProcessor.js';    // 批量处理服务

// 导入工具类
import { OutputFormatter } from './utils/OutputFormatter.js';     // 输出格式化工具
import { Logger } from './utils/Logger.js';                       // 日志工具

/**
 * @class ImageProcessorMCPServer
 * @description 这是整个图片处理工具的入口点。
 * 它遵循模型上下文协议（MCP），将复杂的图片处理功能封装成一系列可供AI调用的标准化工具。
 * 主要职责包括：
 * 1. 初始化并启动一个MCP服务器。
 * 2. 实例化并管理项目的所有核心模块（分析、压缩、转换、颜色提取、批量处理）。
 * 3. 定义AI可以使用的工具集（如`analyze_image`, `compress_image`等），并提供清晰的描述和输入规范。
 * 4. 接收并解析AI的工具调用请求，将其路由到相应的内部处理逻辑。
 * 5. 协调各个模块，完成从图片加载、处理、格式化到返回结果的完整工作流。
 */
class ImageProcessorMCPServer {
  // MCP服务器实例，负责处理协议通信
  private server: Server;
  
  // 各种图片处理服务实例
  private imageAnalyzer: ImageAnalyzer;      // 图片分析服务（OCR、颜色分析、元数据等）
  private imageCompressor: ImageCompressor;  // 图片压缩服务（WebP、AVIF、MozJPEG等）
  private formatConverter: FormatConverter;  // 格式转换服务（JPG/PNG/WebP等互转）
  private colorExtractor: ColorExtractor;    // 颜色提取服务（主色调、调色板等）
  private batchProcessor: BatchProcessor;    // 批量处理服务（并发控制、进度跟踪）
  
  // 工具类实例
  private outputFormatter: OutputFormatter;  // 输出格式化工具（JSON/Markdown/HTML/CSS）
  private logger: Logger;                    // 日志记录工具

  /**
   * 构造函数：初始化MCP服务器和所有服务组件
   */
  constructor() {
    // 创建MCP服务器实例，配置服务器基本信息
    this.server = new Server(
      {
        name: 'image-processor-mcp',    // 服务器名称，用于MCP协议识别
        version: '1.0.0',              // 版本号
        capabilities: {
          tools: {},                    // 声明支持工具调用功能
        },
      }
    );

    // 初始化日志工具（所有服务都需要日志记录）
    this.logger = new Logger();
    
    // 初始化各个图片处理服务，都注入logger实例用于统一日志管理
    this.imageAnalyzer = new ImageAnalyzer(this.logger);
    this.imageCompressor = new ImageCompressor(this.logger);
    this.formatConverter = new FormatConverter(this.logger);
    this.colorExtractor = new ColorExtractor(this.logger);
    this.batchProcessor = new BatchProcessor(this.logger);
    
    // 初始化输出格式化工具（不需要logger）
    this.outputFormatter = new OutputFormatter();

    // 设置MCP协议的请求处理器
    this.setupToolHandlers();
  }

  /**
   * 设置MCP协议的请求处理器
   * 这是MCP服务器的核心，定义了AI模型可以调用的所有工具
   */
  private setupToolHandlers() {
    // 设置工具列表请求处理器
    // 当AI模型询问"有哪些工具可用"时，会调用这个处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // 工具1：智能图片分析
        {
          name: 'analyze_image',  // 工具名称，AI模型调用时使用
          description: '智能分析图片：获取尺寸、格式、颜色分析、OCR文字识别等详细信息',
          // 定义输入参数的JSON Schema，用于验证AI模型传入的参数
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: '图片来源：URL链接或base64数据或本地文件路径'
              },
              options: {
                type: 'object',
                properties: {
                  includeOCR: { type: 'boolean', description: '是否进行OCR文字识别', default: true },
                  includeColors: { type: 'boolean', description: '是否分析颜色信息', default: true },
                  ocrLanguage: { type: 'string', description: 'OCR识别语言', default: 'chi_sim+eng' },
                  outputFormat: { type: 'string', enum: ['json', 'markdown', 'html'], default: 'json' }
                }
              }
            },
            required: ['source']  // 必需参数：图片来源
          }
        },
        {
          name: 'compress_image',
          description: '图片压缩优化：支持多种压缩算法和质量选项',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: '图片来源：URL链接或base64数据或本地文件路径'
              },
              options: {
                type: 'object',
                properties: {
                  quality: { type: 'number', minimum: 1, maximum: 100, description: '压缩质量(1-100)', default: 80 },
                  algorithm: { type: 'string', enum: ['mozjpeg', 'webp', 'avif'], description: '压缩算法', default: 'mozjpeg' },
                  maxWidth: { type: 'number', description: '最大宽度限制' },
                  maxHeight: { type: 'number', description: '最大高度限制' },
                  outputFormat: { type: 'string', enum: ['base64', 'buffer', 'file'], default: 'base64' },
                  outputPath: { type: 'string', description: '指定保存的完整文件路径（仅当outputFormat为file时有效）' },
                  outputDir: { type: 'string', description: '指定保存目录（如果不指定outputPath）', default: './output' }
                }
              }
            },
            required: ['source']
          }
        },
        {
          name: 'convert_format',
          description: '格式转换：支持JPG/PNG/WebP/AVIF等格式互转',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: '图片来源：URL链接或base64数据或本地文件路径'
              },
              targetFormat: {
                type: 'string',
                enum: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'bmp'],
                description: '目标格式'
              },
              options: {
                type: 'object',
                properties: {
                  quality: { type: 'number', minimum: 1, maximum: 100, description: '输出质量', default: 90 },
                  progressive: { type: 'boolean', description: '是否使用渐进式编码', default: false },
                  outputFormat: { type: 'string', enum: ['base64', 'buffer', 'file'], default: 'base64' },
                  outputPath: { type: 'string', description: '指定保存的完整文件路径（仅当outputFormat为file时有效）' },
                  outputDir: { type: 'string', description: '指定保存目录（如果不指定outputPath）', default: './output' }
                }
              }
            },
            required: ['source', 'targetFormat']
          }
        },
        {
          name: 'extract_colors',
          description: '提取图片主色调和配色方案',
          inputSchema: {
            type: 'object',
            properties: {
              source: {
                type: 'string',
                description: '图片来源：URL链接或base64数据或本地文件路径'
              },
              options: {
                type: 'object',
                properties: {
                  colorCount: { type: 'number', minimum: 1, maximum: 20, description: '提取颜色数量', default: 5 },
                  algorithm: { type: 'string', enum: ['vibrant', 'thief'], description: '颜色提取算法', default: 'vibrant' },
                  includeHex: { type: 'boolean', description: '包含HEX颜色值', default: true },
                  includeRgb: { type: 'boolean', description: '包含RGB颜色值', default: true },
                  includeHsl: { type: 'boolean', description: '包含HSL颜色值', default: false },
                  outputFormat: { type: 'string', enum: ['json', 'css', 'html'], default: 'json' }
                }
              }
            },
            required: ['source']
          }
        },
        {
          name: 'batch_process',
          description: '批量图片处理：支持多张图片的批量操作',
          inputSchema: {
            type: 'object',
            properties: {
              sources: {
                type: 'array',
                items: { type: 'string' },
                description: '图片来源列表：URL链接或base64数据或本地文件路径'
              },
              operation: {
                type: 'string',
                enum: ['analyze', 'compress', 'convert', 'extract_colors'],
                description: '批量操作类型'
              },
              options: {
                type: 'object',
                description: '操作选项，根据operation类型而定'
              },
              concurrency: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                description: '并发处理数量',
                default: 3
              }
            },
            required: ['sources', 'operation']
          }
        }
      ]
    }));

    // 注册 "CallTool" 请求的处理器。当AI决定调用上述某个工具时，请求会进入这里。
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // 从请求中提取工具名称和参数
      const { name, arguments: args } = request.params;

      try {
        // 使用 switch 语句将请求分发到对应的处理方法
        switch (name) {
          case 'analyze_image':
            return await this.handleAnalyzeImage(args);
          case 'compress_image':
            return await this.handleCompressImage(args);
          case 'convert_format':
            return await this.handleConvertFormat(args);
          case 'extract_colors':
            return await this.handleExtractColors(args);
          case 'batch_process':
            return await this.handleBatchProcess(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `未知或不支持的工具: ${name}`
            );
        }
      } catch (error) {
        // 捕获所有处理过程中可能发生的错误，并以标准的错误格式返回给AI
        this.logger.error(`处理工具 [${name}] 时发生错误:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `工具执行失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  /**
   * @private
   * @method handleAnalyzeImage
   * @description 处理图片分析请求的完整业务逻辑。
   * 包括OCR文字识别、颜色分析、元数据提取等功能。
   * @param args - 工具调用时传入的参数
   */
  private async handleAnalyzeImage(args: any) {
    const { source, options = {} } = args;
    
    // 1. 执行图片分析（调用ImageAnalyzer服务）
    const result = await this.imageAnalyzer.analyze(source, options);
    
    // 2. 根据用户指定的格式进行输出格式化
    const outputFormat = options.outputFormat || 'json';
    const formattedResult = this.outputFormatter.format(result, outputFormat);
    
    // 3. 返回符合MCP协议的响应格式
    return {
      content: [
        {
          type: 'text',
          text: formattedResult
        }
      ]
    };
  }

  /**
   * @private
   * @method handleCompressImage
   * @description 处理图片压缩请求的完整业务逻辑。
   * 支持多种压缩算法和质量控制。
   * @param args - 工具调用时传入的参数
   */
  private async handleCompressImage(args: any) {
    const { source, options = {} } = args;
    
    // 1. 执行图片压缩（调用ImageCompressor服务）
    const result = await this.imageCompressor.compress(source, options);
    
    // 2. 返回压缩结果（包含原始大小、压缩后大小、压缩比等信息）
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  /**
   * @private
   * @method handleConvertFormat
   * @description 处理图片格式转换请求的完整业务逻辑。
   * 支持主流图片格式之间的互转。
   * @param args - 工具调用时传入的参数
   */
  private async handleConvertFormat(args: any) {
    const { source, targetFormat, options = {} } = args;
    
    // 1. 执行格式转换（调用FormatConverter服务）
    const result = await this.formatConverter.convert(source, targetFormat, options);
    
    // 2. 返回转换结果
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  /**
   * @private
   * @method handleExtractColors
   * @description 处理颜色提取请求的完整业务逻辑。
   * 可提取主色调、调色板等颜色信息。
   * @param args - 工具调用时传入的参数
   */
  private async handleExtractColors(args: any) {
    const { source, options = {} } = args;
    
    // 1. 执行颜色提取（调用ColorExtractor服务）
    const result = await this.colorExtractor.extract(source, options);
    
    // 2. 根据用户指定的格式进行输出格式化
    const outputFormat = options.outputFormat || 'json';
    const formattedResult = this.outputFormatter.format(result, outputFormat);
    
    // 3. 返回格式化后的颜色信息
    return {
      content: [
        {
          type: 'text',
          text: formattedResult
        }
      ]
    };
  }

  /**
   * @private
   * @method handleBatchProcess
   * @description 处理批量处理请求，使用高效的异步并发模式处理多张图片。
   * 支持所有单个操作的批量版本。
   * @param args - 工具调用时传入的参数
   */
  private async handleBatchProcess(args: any) {
    const { sources, operation, options = {}, concurrency = 3 } = args;
    
    // 1. 执行批量处理（内部会使用Promise.allSettled进行并发控制）
    const result = await this.batchProcessor.process(sources, operation, options, concurrency);
    
    // 2. 返回批量处理结果（包含成功/失败统计和详细结果）
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  /**
   * @public
   * @method run
   * @description 启动MCP服务器，开始监听来自AI的请求。
   * 使用标准输入/输出作为通信通道。
   */
  async run() {
    // 使用标准输入/输出作为通信通道，这是MCP协议的标准传输方式
    const transport = new StdioServerTransport();
    
    // 连接服务器到传输层，开始监听请求
    await this.server.connect(transport);
    
    // 在标准错误流中打印日志，避免污染标准输出流的数据通道
    this.logger.info('图片处理 MCP 服务器已成功启动并准备就绪');
  }
}

// ==================== 服务器启动入口 ====================

/**
 * 创建并启动图片处理MCP服务器实例
 * 这是整个应用程序的入口点
 */
const server = new ImageProcessorMCPServer();

// 启动服务器，如果启动失败则退出进程
server.run().catch((error) => {
  console.error('服务器启动失败:', error);
  process.exit(1);  // 以错误状态码退出
});