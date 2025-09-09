import sharp from 'sharp';
import Vibrant from 'node-vibrant';
import { Logger } from '../utils/Logger.js';
import { ImageUtils } from '../utils/ImageUtils.js';

export interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsl?: { h: number; s: number; l: number };
  name?: string;
  percentage?: number;
}

export interface ColorExtractionResult {
  dominantColors: ColorInfo[];
  palette: {
    vibrant?: ColorInfo;
    lightVibrant?: ColorInfo;
    darkVibrant?: ColorInfo;
    muted?: ColorInfo;
    lightMuted?: ColorInfo;
    darkMuted?: ColorInfo;
  };
  statistics: {
    totalColors: number;
    averageColor: ColorInfo;
    brightness: number; // 0-100
    contrast: number;   // 0-100
    saturation: number; // 0-100
  };
  colorHarmony: {
    scheme: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'mixed';
    temperature: 'warm' | 'cool' | 'neutral';
  };
}

export class ColorExtractor {
  constructor(private logger: Logger) {}

  async extract(source: string, options: any = {}): Promise<ColorExtractionResult> {
    this.logger.info('Starting color extraction', { 
      algorithm: options.algorithm || 'vibrant',
      colorCount: options.colorCount || 5 
    });

    try {
      const imageBuffer = await ImageUtils.loadImage(source);
      
      let dominantColors: ColorInfo[];
      let palette: any = {};

      if (options.algorithm === 'thief') {
        dominantColors = await this.extractWithColorThief(imageBuffer, options);
      } else {
        const vibrantResult = await this.extractWithVibrant(imageBuffer, options);
        dominantColors = vibrantResult.dominantColors;
        palette = vibrantResult.palette;
      }

      const statistics = await this.calculateStatistics(imageBuffer, dominantColors);
      const colorHarmony = this.analyzeColorHarmony(dominantColors);

      const result: ColorExtractionResult = {
        dominantColors,
        palette,
        statistics,
        colorHarmony
      };

      this.logger.info('Color extraction completed', {
        colorsFound: dominantColors.length,
        scheme: colorHarmony.scheme,
        temperature: colorHarmony.temperature
      });

      return result;

    } catch (error) {
      this.logger.error('Color extraction failed:', error);
      throw new Error(`Color extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async extractWithVibrant(imageBuffer: Buffer, options: any) {
    const vibrant = new Vibrant(imageBuffer, {
      colorCount: options.colorCount || 64,
      quality: 5
    });

    const palette = await vibrant.getPalette();
    const paletteResult: any = {};
    const dominantColors: ColorInfo[] = [];

    // 提取Vibrant调色板
    for (const [name, swatch] of Object.entries(palette)) {
      if (swatch) {
        const colorInfo = this.createColorInfo((swatch as any).getHex(), (swatch as any).getRgb(), options);
        paletteResult[name.toLowerCase()] = colorInfo;
        dominantColors.push(colorInfo);
      }
    }

    // 按人口排序获取主色调
    const sortedSwatches = Object.values(palette)
      .filter(swatch => swatch !== null)
      .sort((a: any, b: any) => (b as any).getPopulation() - (a as any).getPopulation())
      .slice(0, options.colorCount || 5);

    const sortedDominantColors = sortedSwatches.map((swatch: any) => 
      this.createColorInfo(swatch.getHex(), swatch.getRgb(), options)
    );

    return {
      dominantColors: sortedDominantColors,
      palette: paletteResult
    };
  }

  private async extractWithColorThief(imageBuffer: Buffer, options: any): Promise<ColorInfo[]> {
    // 使用Sharp进行颜色分析的简化实现
    const image = sharp(imageBuffer);
    const { channels } = await image.metadata();
    
    // 缩小图片以提高性能
    const smallImage = await image
      .resize(50, 50, { fit: 'fill' })
      .raw()
      .toBuffer();

    const colorMap = new Map<string, number>();
    const step = channels || 3;

    // 统计颜色频率
    for (let i = 0; i < smallImage.length; i += step) {
      const r = smallImage[i];
      const g = smallImage[i + 1];
      const b = smallImage[i + 2];
      
      // 量化颜色以减少噪音
      const quantizedR = Math.floor(r / 32) * 32;
      const quantizedG = Math.floor(g / 32) * 32;
      const quantizedB = Math.floor(b / 32) * 32;
      
      const key = `${quantizedR},${quantizedG},${quantizedB}`;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }

    // 获取最频繁的颜色
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, options.colorCount || 5);

    return sortedColors.map(([rgbString, count]) => {
      const [r, g, b] = rgbString.split(',').map(Number);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      return this.createColorInfo(hex, [r, g, b], options);
    });
  }

  private createColorInfo(hex: string, rgb: number[] | { r: number; g: number; b: number }, options: any): ColorInfo {
    const rgbObj = Array.isArray(rgb) ? { r: rgb[0], g: rgb[1], b: rgb[2] } : rgb;
    
    const colorInfo: ColorInfo = {
      hex,
      rgb: rgbObj
    };

    if (options.includeHsl !== false) {
      colorInfo.hsl = this.rgbToHsl(rgbObj.r, rgbObj.g, rgbObj.b);
    }

    return colorInfo;
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  private async calculateStatistics(imageBuffer: Buffer, dominantColors: ColorInfo[]) {
    const image = sharp(imageBuffer);
    const stats = await image.stats();
    
    // 计算平均颜色
    const avgR = Math.round(stats.channels[0].mean);
    const avgG = Math.round(stats.channels[1].mean);
    const avgB = Math.round(stats.channels[2].mean);
    
    const averageColor: ColorInfo = {
      hex: `#${avgR.toString(16).padStart(2, '0')}${avgG.toString(16).padStart(2, '0')}${avgB.toString(16).padStart(2, '0')}`,
      rgb: { r: avgR, g: avgG, b: avgB }
    };

    // 计算亮度
    const brightness = Math.round((avgR * 0.299 + avgG * 0.587 + avgB * 0.114) / 255 * 100);

    // 计算对比度（基于标准差）
    const contrast = Math.round(Math.sqrt(
      Math.pow(stats.channels[0].stdev, 2) +
      Math.pow(stats.channels[1].stdev, 2) +
      Math.pow(stats.channels[2].stdev, 2)
    ) / 255 * 100);

    // 计算饱和度
    const saturation = dominantColors.length > 0 
      ? Math.round(dominantColors.reduce((sum, color) => {
          const hsl = this.rgbToHsl(color.rgb.r, color.rgb.g, color.rgb.b);
          return sum + hsl.s;
        }, 0) / dominantColors.length)
      : 0;

    return {
      totalColors: dominantColors.length,
      averageColor,
      brightness,
      contrast,
      saturation
    };
  }

  private analyzeColorHarmony(colors: ColorInfo[]) {
    if (colors.length === 0) {
      return { scheme: 'mixed' as const, temperature: 'neutral' as const };
    }

    // 转换为HSL进行分析
    const hslColors = colors.map(color => this.rgbToHsl(color.rgb.r, color.rgb.g, color.rgb.b));
    
    // 分析色相分布
    const hues = hslColors.map(hsl => hsl.h);
    const hueRange = Math.max(...hues) - Math.min(...hues);
    
    let scheme: 'monochromatic' | 'analogous' | 'complementary' | 'triadic' | 'mixed';
    
    if (hueRange < 30) {
      scheme = 'monochromatic';
    } else if (hueRange < 60) {
      scheme = 'analogous';
    } else if (hues.some(h1 => hues.some(h2 => Math.abs(h1 - h2) > 150 && Math.abs(h1 - h2) < 210))) {
      scheme = 'complementary';
    } else if (hues.length >= 3 && this.isTriadic(hues)) {
      scheme = 'triadic';
    } else {
      scheme = 'mixed';
    }

    // 分析色温
    const warmColors = colors.filter(color => {
      const hsl = this.rgbToHsl(color.rgb.r, color.rgb.g, color.rgb.b);
      return (hsl.h >= 0 && hsl.h <= 60) || (hsl.h >= 300 && hsl.h <= 360);
    });
    
    const coolColors = colors.filter(color => {
      const hsl = this.rgbToHsl(color.rgb.r, color.rgb.g, color.rgb.b);
      return hsl.h >= 180 && hsl.h <= 240;
    });

    let temperature: 'warm' | 'cool' | 'neutral';
    if (warmColors.length > coolColors.length * 1.5) {
      temperature = 'warm';
    } else if (coolColors.length > warmColors.length * 1.5) {
      temperature = 'cool';
    } else {
      temperature = 'neutral';
    }

    return { scheme, temperature };
  }

  private isTriadic(hues: number[]): boolean {
    // 简化的三色调检测
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        for (let k = j + 1; k < hues.length; k++) {
          const diff1 = Math.abs(hues[i] - hues[j]);
          const diff2 = Math.abs(hues[j] - hues[k]);
          const diff3 = Math.abs(hues[k] - hues[i]);
          
          if (Math.abs(diff1 - 120) < 30 && Math.abs(diff2 - 120) < 30 && Math.abs(diff3 - 120) < 30) {
            return true;
          }
        }
      }
    }
    return false;
  }
}