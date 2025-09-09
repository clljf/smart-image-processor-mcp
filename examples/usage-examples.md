# 🖼️ Image Processor MCP Server 使用示例

本文档提供了详细的使用示例，展示如何使用各种图片处理功能。

## 📋 目录

1. [图片分析示例](#图片分析示例)
2. [图片压缩示例](#图片压缩示例)
3. [格式转换示例](#格式转换示例)
4. [颜色提取示例](#颜色提取示例)
5. [批量处理示例](#批量处理示例)
6. [实际应用场景](#实际应用场景)

## 图片分析示例

### 基础分析

```json
{
  "name": "analyze_image",
  "arguments": {
    "source": "https://picsum.photos/1920/1080",
    "options": {
      "includeOCR": false,
      "includeColors": true,
      "outputFormat": "json"
    }
  }
}
```

**输出结果：**
```json
{
  "metadata": {
    "width": 1920,
    "height": 1080,
    "format": "jpeg",
    "size": 245760,
    "hasAlpha": false,
    "colorSpace": "srgb",
    "channels": 3
  },
  "analysis": {
    "aspectRatio": 1.78,
    "orientation": "landscape",
    "quality": "high",
    "complexity": "moderate"
  },
  "colors": {
    "dominant": ["#4a90e2"],
    "palette": [
      { "color": "#4a90e2", "percentage": 35 },
      { "color": "#7ed321", "percentage": 25 },
      { "color": "#f5a623", "percentage": 20 }
    ],
    "averageColor": "#6b8ca3"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### OCR文字识别

```json
{
  "name": "analyze_image",
  "arguments": {
    "source": "./examples/text-image.png",
    "options": {
      "includeOCR": true,
      "ocrLanguage": "chi_sim+eng",
      "includeColors": false,
      "outputFormat": "markdown"
    }
  }
}
```

**输出结果（Markdown格式）：**
```markdown
# 图片分析报告

## 📊 基本信息
| 属性 | 值 |
|------|-----|
| 尺寸 | 800 × 600 px |
| 格式 | PNG |
| 文件大小 | 156 KB |

## 📝 文字识别 (OCR)
**识别置信度:** 92%

**识别文本:**
```
欢迎使用图片处理服务
Welcome to Image Processing Service
```

**词汇详情:**
| 文字 | 置信度 | 位置 |
|------|--------|------|
| 欢迎 | 95% | (120, 200) |
| 使用 | 90% | (180, 200) |
| Welcome | 94% | (120, 250) |
```

## 图片压缩示例

### Web优化压缩

```json
{
  "name": "compress_image",
  "arguments": {
    "source": "https://example.com/large-photo.jpg",
    "options": {
      "quality": 80,
      "algorithm": "webp",
      "maxWidth": 1200,
      "maxHeight": 800,
      "outputFormat": "base64"
    }
  }
}
```

**输出结果：**
```json
{
  "originalSize": 2048576,
  "compressedSize": 245760,
  "compressionRatio": 88,
  "format": "webp",
  "quality": 80,
  "data": "data:image/webp;base64,UklGRnoAAABXRUJQVlA4WAoAAAAQAAAADwAABwAAQUxQSDIAAAARL0AmbZurmr57yyIiqE8oiG0bejIYEQTgqiDA9vqnsUSI6H+oAERp2HZ65qP/VIAWAFZQOCBCAAAA8AEAnQEqEAAIAAVAfCWkAALp8sF8rgRgAP7o9FDvMCkMde9PK7euH5M1m6VWoDXf2FkP3BqV0ZYbO6NA/VFIAAAA",
  "metadata": {
    "width": 1200,
    "height": 800,
    "algorithm": "webp"
  }
}
```

### 目标大小优化

```json
{
  "name": "compress_image",
  "arguments": {
    "source": "data:image/jpeg;base64,/9j/4AAQ...",
    "options": {
      "algorithm": "mozjpeg",
      "targetSize": 102400,
      "outputFormat": "file"
    }
  }
}
```

## 格式转换示例

### 现代格式转换

```json
{
  "name": "convert_format",
  "arguments": {
    "source": "./input/old-photo.bmp",
    "targetFormat": "avif",
    "options": {
      "quality": 85,
      "outputFormat": "base64"
    }
  }
}
```

**输出结果：**
```json
{
  "originalFormat": "bmp",
  "targetFormat": "avif",
  "originalSize": 1572864,
  "convertedSize": 98304,
  "data": "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYx...",
  "metadata": {
    "width": 1024,
    "height": 768,
    "quality": 85,
    "progressive": false
  }
}
```

### 响应式版本生成

```json
{
  "name": "convert_format",
  "arguments": {
    "source": "https://example.com/hero-image.jpg",
    "targetFormat": "webp",
    "options": {
      "createResponsive": true,
      "sizes": [480, 768, 1024, 1920],
      "quality": 85
    }
  }
}
```

## 颜色提取示例

### 详细颜色分析

```json
{
  "name": "extract_colors",
  "arguments": {
    "source": "https://example.com/colorful-artwork.jpg",
    "options": {
      "colorCount": 8,
      "algorithm": "vibrant",
      "includeHex": true,
      "includeRgb": true,
      "includeHsl": true,
      "outputFormat": "html"
    }
  }
}
```

**输出结果（HTML格式）：**
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <title>颜色提取结果</title>
    <style>
        .color-swatch { width: 60px; height: 60px; border-radius: 8px; }
        .palette-section { margin: 20px 0; }
    </style>
</head>
<body>
    <h1>🎨 颜色提取结果</h1>
    <div class="palette-section">
        <h2>主色调</h2>
        <div style="display: flex; align-items: center;">
            <div class="color-swatch" style="background-color: #ff6b6b;"></div>
            <span>RGB(255, 107, 107) - 暖红色</span>
        </div>
    </div>
</body>
</html>
```

### CSS变量生成

```json
{
  "name": "extract_colors",
  "arguments": {
    "source": "./brand-logo.png",
    "options": {
      "colorCount": 5,
      "outputFormat": "css"
    }
  }
}
```

**输出结果：**
```css
/* Generated CSS Color Variables */
:root {
  --color-1: #ff6b6b;
  --color-1-rgb: 255, 107, 107;
  --color-2: #4ecdc4;
  --color-2-rgb: 78, 205, 196;
  --color-3: #45b7d1;
  --color-3-rgb: 69, 183, 209;
  --average-color: #6b8ca3;
}

/* Utility Classes */
.bg-color-1 { background-color: var(--color-1); }
.text-color-1 { color: var(--color-1); }
.border-color-1 { border-color: var(--color-1); }
```

## 批量处理示例

### 批量压缩

```json
{
  "name": "batch_process",
  "arguments": {
    "sources": [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.png",
      "./local/photo3.gif",
      "data:image/jpeg;base64,/9j/4AAQ..."
    ],
    "operation": "compress",
    "options": {
      "quality": 75,
      "algorithm": "webp",
      "maxWidth": 1200
    },
    "concurrency": 3
  }
}
```

**输出结果：**
```json
{
  "totalProcessed": 4,
  "successful": 3,
  "failed": 1,
  "results": [
    {
      "source": "https://example.com/photo1.jpg",
      "success": true,
      "result": { "compressionRatio": 65, "format": "webp" },
      "processingTime": 1250
    },
    {
      "source": "./local/photo3.gif",
      "success": false,
      "error": "File not found",
      "processingTime": 0
    }
  ],
  "summary": {
    "totalTime": 3750,
    "averageTime": 1250,
    "successRate": 75
  }
}
```

### 批量格式转换

```json
{
  "name": "batch_process",
  "arguments": {
    "sources": [
      "./images/img1.png",
      "./images/img2.jpg",
      "./images/img3.bmp"
    ],
    "operation": "convert",
    "options": {
      "targetFormat": "webp",
      "quality": 90
    },
    "concurrency": 2
  }
}
```

## 实际应用场景

### 1. 电商产品图片优化

```json
{
  "name": "batch_process",
  "arguments": {
    "sources": ["./products/product-001.jpg", "./products/product-002.jpg"],
    "operation": "compress",
    "options": {
      "algorithm": "webp",
      "quality": 85,
      "maxWidth": 800,
      "maxHeight": 800
    }
  }
}
```

### 2. 网站图片现代化

```json
{
  "name": "convert_format",
  "arguments": {
    "source": "./legacy/hero-banner.jpg",
    "targetFormat": "avif",
    "options": {
      "quality": 80,
      "createResponsive": true,
      "sizes": [480, 768, 1024, 1920]
    }
  }
}
```

### 3. 品牌色彩提取

```json
{
  "name": "extract_colors",
  "arguments": {
    "source": "./brand/logo.svg",
    "options": {
      "colorCount": 6,
      "outputFormat": "css",
      "algorithm": "vibrant"
    }
  }
}
```

### 4. 文档OCR处理

```json
{
  "name": "analyze_image",
  "arguments": {
    "source": "./documents/scan.pdf.jpg",
    "options": {
      "includeOCR": true,
      "ocrLanguage": "chi_sim+eng",
      "outputFormat": "markdown"
    }
  }
}
```

### 5. 社交媒体图片优化

```json
{
  "name": "compress_image",
  "arguments": {
    "source": "https://cdn.example.com/user-upload.jpg",
    "options": {
      "algorithm": "webp",
      "quality": 80,
      "maxWidth": 1080,
      "maxHeight": 1080
    }
  }
}
```

## 💡 最佳实践

1. **选择合适的压缩算法**：
   - WebP：通用性好，压缩率高
   - AVIF：最新标准，压缩率最高
   - MozJPEG：兼容性最好

2. **批量处理优化**：
   - 设置合理的并发数（3-5）
   - 预先验证图片源
   - 监控处理进度

3. **输出格式选择**：
   - JSON：程序处理
   - Markdown：人类阅读
   - HTML：可视化展示
   - CSS：直接使用

4. **错误处理**：
   - 检查网络连接
   - 验证图片格式
   - 处理超时情况