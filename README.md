# 🖼️ Image Processor MCP Server

一个功能强大的图片处理与分析MCP服务器，提供智能图片分析、压缩优化、格式转换、颜色提取等功能。

## ✨ 核心功能

### 🔍 智能图片分析 (`analyze_image`)
- **基础信息分析**：尺寸、格式、文件大小、颜色通道等
- **OCR文字识别**：支持中英文混合识别，提供置信度和位置信息
- **颜色分析**：提取主色调和调色板
- **图片质量评估**：分析图片质量、复杂度、方向等

### 🗜️ 图片压缩优化 (`compress_image`)
- **多种压缩算法**：MozJPEG、WebP、AVIF
- **智能质量控制**：支持目标文件大小优化
- **尺寸限制**：可设置最大宽高限制
- **Web优化**：专门的Web图片优化功能

### 🔄 格式转换 (`convert_format`)
- **全格式支持**：JPG、PNG、WebP、AVIF、GIF、BMP、TIFF
- **智能格式选择**：根据图片特性自动选择最佳现代格式
- **响应式版本**：一键生成多尺寸响应式图片
- **质量控制**：精确的质量和压缩参数控制

### 🎨 颜色提取 (`extract_colors`)
- **多种算法**：Vibrant和ColorThief算法
- **完整调色板**：提取主色调、鲜艳色、柔和色等
- **色彩分析**：亮度、对比度、饱和度统计
- **色彩和谐**：分析配色方案和色温

### ⚡ 批量处理 (`batch_process`)
- **并发控制**：可配置并发数量，避免系统过载
- **进度跟踪**：实时处理进度反馈
- **错误处理**：详细的成功/失败统计
- **批量验证**：预先验证图片源的有效性

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 构建项目

```bash
npm run build
```

### 启动服务器

```bash
npm start
```

### 开发模式

```bash
npm run dev
```


### MCP 服务器配置：image-processor
```json
{
  "mcpServers": {
    "image-processor": {
      "command": "npx",
      "args": ["-y", "@chenlei28188/image-processor-mcp@latest"]
    }
  }
}
```


## 🎯 图片来源支持

- **🌐 网络图片**：`https://example.com/image.jpg`
- **📁 本地文件**：`./images/photo.png`
- **📋 Base64数据**：`data:image/jpeg;base64,/9j/4AAQ...`

## 🔧 技术架构

### 核心依赖
- **Sharp**：高性能图片处理库
- **Tesseract.js**：OCR文字识别引擎
- **Node Vibrant**：智能颜色提取
- **Canvas API**：图片渲染和分析
- **Axios**：网络图片下载

### 架构优势
- ✅ **跨平台兼容**：基于Node.js，无系统依赖
- ✅ **高性能处理**：使用Sharp进行硬件加速
- ✅ **智能错误处理**：完善的重试和降级机制
- ✅ **内存优化**：流式处理，避免内存溢出
- ✅ **并发控制**：可配置的并发限制

## 🛠️ 开发指南

### 项目结构

```
src/
├── index.ts              # MCP服务器入口
├── services/             # 核心服务
│   ├── ImageAnalyzer.ts  # 图片分析服务
│   ├── ImageCompressor.ts # 图片压缩服务
│   ├── FormatConverter.ts # 格式转换服务
│   ├── ColorExtractor.ts # 颜色提取服务
│   └── BatchProcessor.ts # 批量处理服务
└── utils/                # 工具类
    ├── Logger.ts         # 日志工具
    ├── ImageUtils.ts     # 图片工具
    └── OutputFormatter.ts # 输出格式化
```



