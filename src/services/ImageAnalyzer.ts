import sharp from 'sharp';
import Tesseract from 'tesseract.js';
import { Logger } from '../utils/Logger.js';
import { ImageUtils } from '../utils/ImageUtils.js';

export interface ImageAnalysisResult {
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
    density?: number;
    hasAlpha: boolean;
    colorSpace: string;
    channels: number;
  };
  colors?: {
    dominant: string[];
    palette: Array<{ color: string; percentage: number }>;
    averageColor: string;
  };
  ocr?: {
    text: string;
    confidence: number;
    words: Array<{
      text: string;
      confidence: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>;
  };
  analysis: {
    aspectRatio: number;
    orientation: 'landscape' | 'portrait' | 'square';
    quality: 'low' | 'medium' | 'high';
    complexity: 'simple' | 'moderate' | 'complex';
  };
  timestamp: string;
}

export class ImageAnalyzer {
  constructor(private logger: Logger) {}

  async analyze(source: string, options: any = {}): Promise<ImageAnalysisResult> {
    this.logger.info('Starting image analysis', { source: source.substring(0, 50) + '...' });

    try {
      const imageBuffer = await ImageUtils.loadImage(source);
      const metadata = await this.analyzeMetadata(imageBuffer);
      
      const result: ImageAnalysisResult = {
        metadata,
        analysis: this.analyzeImageProperties(metadata),
        timestamp: new Date().toISOString()
      };

      // 颜色分析
      if (options.includeColors !== false) {
        result.colors = await this.analyzeColors(imageBuffer);
      }

      // OCR文字识别
      if (options.includeOCR !== false) {
        result.ocr = await this.performOCR(imageBuffer, options.ocrLanguage || 'chi_sim+eng');
      }

      this.logger.info('Image analysis completed successfully');
      return result;

    } catch (error) {
      this.logger.error('Image analysis failed:', error);
      throw new Error(`Image analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async analyzeMetadata(imageBuffer: Buffer) {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const stats = await image.stats();

    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: imageBuffer.length,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha || false,
      colorSpace: metadata.space || 'unknown',
      channels: metadata.channels || 0
    };
  }

  private analyzeImageProperties(metadata: any) {
    const { width, height, size } = metadata;
    const aspectRatio = width / height;
    
    let orientation: 'landscape' | 'portrait' | 'square';
    if (aspectRatio > 1.1) orientation = 'landscape';
    else if (aspectRatio < 0.9) orientation = 'portrait';
    else orientation = 'square';

    let quality: 'low' | 'medium' | 'high';
    const totalPixels = width * height;
    if (totalPixels < 100000) quality = 'low';
    else if (totalPixels < 2000000) quality = 'medium';
    else quality = 'high';

    let complexity: 'simple' | 'moderate' | 'complex';
    const bytesPerPixel = size / totalPixels;
    if (bytesPerPixel < 1) complexity = 'simple';
    else if (bytesPerPixel < 3) complexity = 'moderate';
    else complexity = 'complex';

    return {
      aspectRatio: Math.round(aspectRatio * 100) / 100,
      orientation,
      quality,
      complexity
    };
  }

  private async analyzeColors(imageBuffer: Buffer) {
    try {
      const image = sharp(imageBuffer);
      const stats = await image.stats();
      
      // 获取主色调
      const channels = stats.channels;
      const dominantColors = channels.map((channel: any) => 
        Math.round(channel.mean).toString(16).padStart(2, '0')
      );
      const averageColor = `#${dominantColors.join('')}`;

      // 简化的调色板分析
      const resized = await image.resize(50, 50).raw().toBuffer();
      const palette = this.extractPalette(resized);

      return {
        dominant: [averageColor],
        palette,
        averageColor
      };
    } catch (error) {
      this.logger.warn('Color analysis failed:', error);
      return {
        dominant: ['#000000'],
        palette: [{ color: '#000000', percentage: 100 }],
        averageColor: '#000000'
      };
    }
  }

  private extractPalette(buffer: Buffer): Array<{ color: string; percentage: number }> {
    const colorMap = new Map<string, number>();
    
    for (let i = 0; i < buffer.length; i += 3) {
      const r = buffer[i];
      const g = buffer[i + 1];
      const b = buffer[i + 2];
      const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      colorMap.set(color, (colorMap.get(color) || 0) + 1);
    }

    const totalPixels = buffer.length / 3;
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color, count]) => ({
        color,
        percentage: Math.round((count / totalPixels) * 100)
      }));

    return sortedColors;
  }

  private async performOCR(imageBuffer: Buffer, language: string) {
    try {
      this.logger.info('Starting OCR recognition', { language });
      
      const { data } = await Tesseract.recognize(imageBuffer, language, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            this.logger.debug(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const words = data.words.map(word => ({
        text: word.text,
        confidence: Math.round(word.confidence),
        bbox: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0
        }
      }));

      return {
        text: data.text.trim(),
        confidence: Math.round(data.confidence),
        words
      };
    } catch (error) {
      this.logger.warn('OCR recognition failed:', error);
      return {
        text: '',
        confidence: 0,
        words: []
      };
    }
  }
}