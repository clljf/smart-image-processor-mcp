export class OutputFormatter {
  format(data: any, format: string): string {
    switch (format.toLowerCase()) {
      case 'json':
        return this.formatAsJson(data);
      case 'markdown':
        return this.formatAsMarkdown(data);
      case 'html':
        return this.formatAsHtml(data);
      case 'css':
        return this.formatAsCss(data);
      default:
        return this.formatAsJson(data);
    }
  }

  private formatAsJson(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  private formatAsMarkdown(data: any): string {
    if (data.metadata) {
      return this.formatImageAnalysisAsMarkdown(data);
    } else if (data.dominantColors) {
      return this.formatColorExtractionAsMarkdown(data);
    } else {
      return `\`\`\`json\n${this.formatAsJson(data)}\n\`\`\``;
    }
  }

  private formatImageAnalysisAsMarkdown(analysis: any): string {
    const { metadata, colors, ocr, analysis: imageAnalysis } = analysis;
    
    let markdown = `# 图片分析报告\n\n`;
    
    // 基本信息
    markdown += `## 📊 基本信息\n\n`;
    markdown += `| 属性 | 值 |\n`;
    markdown += `|------|----|\n`;
    markdown += `| 尺寸 | ${metadata.width} × ${metadata.height} px |\n`;
    markdown += `| 格式 | ${metadata.format.toUpperCase()} |\n`;
    markdown += `| 文件大小 | ${this.formatFileSize(metadata.size)} |\n`;
    markdown += `| 颜色通道 | ${metadata.channels} |\n`;
    markdown += `| 透明通道 | ${metadata.hasAlpha ? '是' : '否'} |\n`;
    markdown += `| 颜色空间 | ${metadata.colorSpace} |\n\n`;

    // 图片分析
    markdown += `## 🔍 图片分析\n\n`;
    markdown += `| 属性 | 值 |\n`;
    markdown += `|------|----|\n`;
    markdown += `| 宽高比 | ${imageAnalysis.aspectRatio} |\n`;
    markdown += `| 方向 | ${this.translateOrientation(imageAnalysis.orientation)} |\n`;
    markdown += `| 质量 | ${this.translateQuality(imageAnalysis.quality)} |\n`;
    markdown += `| 复杂度 | ${this.translateComplexity(imageAnalysis.complexity)} |\n\n`;

    // 颜色信息
    if (colors) {
      markdown += `## 🎨 颜色分析\n\n`;
      markdown += `**主色调:** ${colors.averageColor}\n\n`;
      
      if (colors.palette && colors.palette.length > 0) {
        markdown += `**调色板:**\n\n`;
        colors.palette.forEach((color: any, index: number) => {
          markdown += `${index + 1}. ${color.color} (${color.percentage}%)\n`;
        });
        markdown += `\n`;
      }
    }

    // OCR结果
    if (ocr && ocr.text) {
      markdown += `## 📝 文字识别 (OCR)\n\n`;
      markdown += `**识别置信度:** ${ocr.confidence}%\n\n`;
      markdown += `**识别文本:**\n\n`;
      markdown += `\`\`\`\n${ocr.text}\n\`\`\`\n\n`;
      
      if (ocr.words && ocr.words.length > 0) {
        markdown += `**词汇详情:**\n\n`;
        markdown += `| 文字 | 置信度 | 位置 |\n`;
        markdown += `|------|--------|------|\n`;
        ocr.words.forEach((word: any) => {
          markdown += `| ${word.text} | ${word.confidence}% | (${word.bbox.x}, ${word.bbox.y}) |\n`;
        });
        markdown += `\n`;
      }
    }

    markdown += `---\n*报告生成时间: ${new Date(analysis.timestamp).toLocaleString('zh-CN')}*`;
    
    return markdown;
  }

  private formatColorExtractionAsMarkdown(colorData: any): string {
    const { dominantColors, palette, statistics, colorHarmony } = colorData;
    
    let markdown = `# 🎨 颜色提取报告\n\n`;

    // 主色调
    markdown += `## 主色调\n\n`;
    dominantColors.forEach((color: any, index: number) => {
      markdown += `${index + 1}. **${color.hex}** `;
      if (color.rgb) {
        markdown += `RGB(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}) `;
      }
      if (color.hsl) {
        markdown += `HSL(${color.hsl.h}°, ${color.hsl.s}%, ${color.hsl.l}%)`;
      }
      markdown += `\n`;
    });
    markdown += `\n`;

    // 调色板
    if (palette && Object.keys(palette).length > 0) {
      markdown += `## 调色板\n\n`;
      Object.entries(palette).forEach(([name, color]: [string, any]) => {
        if (color) {
          markdown += `- **${this.translatePaletteName(name)}:** ${color.hex}\n`;
        }
      });
      markdown += `\n`;
    }

    // 统计信息
    if (statistics) {
      markdown += `## 📊 颜色统计\n\n`;
      markdown += `| 属性 | 值 |\n`;
      markdown += `|------|----|\n`;
      markdown += `| 颜色总数 | ${statistics.totalColors} |\n`;
      markdown += `| 平均颜色 | ${statistics.averageColor.hex} |\n`;
      markdown += `| 亮度 | ${statistics.brightness}% |\n`;
      markdown += `| 对比度 | ${statistics.contrast}% |\n`;
      markdown += `| 饱和度 | ${statistics.saturation}% |\n\n`;
    }

    // 色彩和谐
    if (colorHarmony) {
      markdown += `## 🎭 色彩和谐分析\n\n`;
      markdown += `- **配色方案:** ${this.translateColorScheme(colorHarmony.scheme)}\n`;
      markdown += `- **色温:** ${this.translateTemperature(colorHarmony.temperature)}\n\n`;
    }

    return markdown;
  }

  private formatAsHtml(data: any): string {
    if (data.dominantColors) {
      return this.formatColorExtractionAsHtml(data);
    } else if (data.metadata) {
      return this.formatImageAnalysisAsHtml(data);
    } else {
      return `<pre><code>${JSON.stringify(data, null, 2)}</code></pre>`;
    }
  }

  private formatColorExtractionAsHtml(colorData: any): string {
    const { dominantColors, palette, statistics } = colorData;
    
    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>颜色提取结果</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }
        .color-swatch { display: inline-block; width: 60px; height: 60px; margin: 5px; border-radius: 8px; border: 2px solid #ddd; }
        .color-info { margin: 10px 0; }
        .palette-section { margin: 20px 0; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { background: #f8f9fa; padding: 15px; border-radius: 8px; }
    </style>
</head>
<body>
    <h1>🎨 颜色提取结果</h1>
    
    <div class="palette-section">
        <h2>主色调</h2>
        <div class="color-info">
`;

    dominantColors.forEach((color: any) => {
      html += `
            <div style="display: flex; align-items: center; margin: 10px 0;">
                <div class="color-swatch" style="background-color: ${color.hex};"></div>
                <div style="margin-left: 15px;">
                    <strong>${color.hex}</strong><br>
                    RGB(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})
                </div>
            </div>`;
    });

    html += `
        </div>
    </div>`;

    if (statistics) {
      html += `
    <div class="palette-section">
        <h2>📊 统计信息</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <h3>平均颜色</h3>
                <div style="display: flex; align-items: center;">
                    <div class="color-swatch" style="background-color: ${statistics.averageColor.hex};"></div>
                    <span style="margin-left: 10px;">${statistics.averageColor.hex}</span>
                </div>
            </div>
            <div class="stat-card">
                <h3>亮度</h3>
                <div style="font-size: 24px; font-weight: bold;">${statistics.brightness}%</div>
            </div>
            <div class="stat-card">
                <h3>对比度</h3>
                <div style="font-size: 24px; font-weight: bold;">${statistics.contrast}%</div>
            </div>
            <div class="stat-card">
                <h3>饱和度</h3>
                <div style="font-size: 24px; font-weight: bold;">${statistics.saturation}%</div>
            </div>
        </div>
    </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  private formatImageAnalysisAsHtml(analysis: any): string {
    // 简化的HTML格式，主要显示关键信息
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>图片分析结果</title>
    <style>
        body { font-family: system-ui, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>📊 图片分析结果</h1>
    <table>
        <tr><th>属性</th><th>值</th></tr>
        <tr><td>尺寸</td><td>${analysis.metadata.width} × ${analysis.metadata.height} px</td></tr>
        <tr><td>格式</td><td>${analysis.metadata.format.toUpperCase()}</td></tr>
        <tr><td>文件大小</td><td>${this.formatFileSize(analysis.metadata.size)}</td></tr>
        <tr><td>宽高比</td><td>${analysis.analysis.aspectRatio}</td></tr>
        <tr><td>方向</td><td>${this.translateOrientation(analysis.analysis.orientation)}</td></tr>
    </table>
</body>
</html>`;
  }

  private formatAsCss(data: any): string {
    if (!data.dominantColors) {
      return '/* No color data available */';
    }

    let css = `/* Generated CSS Color Variables */\n:root {\n`;
    
    data.dominantColors.forEach((color: any, index: number) => {
      css += `  --color-${index + 1}: ${color.hex};\n`;
      if (color.rgb) {
        css += `  --color-${index + 1}-rgb: ${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b};\n`;
      }
    });

    if (data.statistics && data.statistics.averageColor) {
      css += `  --average-color: ${data.statistics.averageColor.hex};\n`;
    }

    css += `}\n\n`;

    // 生成实用的CSS类
    css += `/* Utility Classes */\n`;
    data.dominantColors.forEach((color: any, index: number) => {
      css += `.bg-color-${index + 1} { background-color: var(--color-${index + 1}); }\n`;
      css += `.text-color-${index + 1} { color: var(--color-${index + 1}); }\n`;
      css += `.border-color-${index + 1} { border-color: var(--color-${index + 1}); }\n\n`;
    });

    return css;
  }

  // 辅助方法
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  private translateOrientation(orientation: string): string {
    const translations: { [key: string]: string } = {
      'landscape': '横向',
      'portrait': '纵向',
      'square': '正方形'
    };
    return translations[orientation] || orientation;
  }

  private translateQuality(quality: string): string {
    const translations: { [key: string]: string } = {
      'low': '低',
      'medium': '中',
      'high': '高'
    };
    return translations[quality] || quality;
  }

  private translateComplexity(complexity: string): string {
    const translations: { [key: string]: string } = {
      'simple': '简单',
      'moderate': '中等',
      'complex': '复杂'
    };
    return translations[complexity] || complexity;
  }

  private translatePaletteName(name: string): string {
    const translations: { [key: string]: string } = {
      'vibrant': '鲜艳',
      'lightvibrant': '浅鲜艳',
      'darkvibrant': '深鲜艳',
      'muted': '柔和',
      'lightmuted': '浅柔和',
      'darkmuted': '深柔和'
    };
    return translations[name] || name;
  }

  private translateColorScheme(scheme: string): string {
    const translations: { [key: string]: string } = {
      'monochromatic': '单色调',
      'analogous': '类似色',
      'complementary': '互补色',
      'triadic': '三色调',
      'mixed': '混合色'
    };
    return translations[scheme] || scheme;
  }

  private translateTemperature(temperature: string): string {
    const translations: { [key: string]: string } = {
      'warm': '暖色调',
      'cool': '冷色调',
      'neutral': '中性色调'
    };
    return translations[temperature] || temperature;
  }
}