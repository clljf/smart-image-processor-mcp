# 图片处理MCP - 自定义保存路径使用指南

## 概述

图片处理MCP现在支持用户指定保存路径，让每个用户都可以将处理后的图片保存到自己指定的位置。

## 使用方法

### 1. 使用默认路径（原有方式）

```json
{
  "name": "convert_format",
  "arguments": {
    "source": "https://example.com/image.jpg",
    "targetFormat": "webp",
    "options": {
      "outputFormat": "file",
      "quality": 90
    }
  }
}
```

**结果**：文件保存到默认的 `./output` 目录，使用随机UUID文件名。

### 2. 指定自定义目录

```json
{
  "name": "convert_format",
  "arguments": {
    "source": "https://example.com/image.jpg",
    "targetFormat": "webp",
    "options": {
      "outputFormat": "file",
      "outputDir": "/path/to/your/directory",
      "quality": 90
    }
  }
}
```

**结果**：文件保存到指定目录，使用随机UUID文件名。

### 3. 指定完整文件路径

```json
{
  "name": "convert_format",
  "arguments": {
    "source": "https://example.com/image.jpg",
    "targetFormat": "webp",
    "options": {
      "outputFormat": "file",
      "outputPath": "/path/to/your/custom_name.webp",
      "quality": 90
    }
  }
}
```

**结果**：文件保存到指定的完整路径，使用指定的文件名。

## 支持的工具

以下工具都支持自定义路径功能：

### convert_format（格式转换）
- `outputDir`: 指定保存目录
- `outputPath`: 指定完整文件路径

### compress_image（图片压缩）
- `outputDir`: 指定保存目录  
- `outputPath`: 指定完整文件路径

## 路径处理规则

1. **优先级**：`outputPath` > `outputDir` > 默认路径
2. **自动扩展名**：如果 `outputPath` 没有正确的扩展名，会自动添加
3. **目录创建**：如果指定的目录不存在，会自动创建
4. **绝对路径**：始终返回绝对路径，方便用户定位文件

## 示例场景

### 场景1：多用户环境
```json
{
  "name": "convert_format",
  "arguments": {
    "source": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
    "targetFormat": "webp",
    "options": {
      "outputFormat": "file",
      "outputDir": "/home/user123/images",
      "quality": 85
    }
  }
}
```

### 场景2：项目特定命名
```json
{
  "name": "compress_image",
  "arguments": {
    "source": "https://example.com/product-photo.jpg",
    "options": {
      "outputFormat": "file",
      "outputPath": "/project/assets/product-photo-compressed.jpg",
      "quality": 75,
      "algorithm": "mozjpeg"
    }
  }
}
```

### 场景3：批量处理到指定目录
```json
{
  "name": "batch_process",
  "arguments": {
    "sources": ["image1.jpg", "image2.png", "image3.gif"],
    "operation": "convert",
    "options": {
      "targetFormat": "webp",
      "outputFormat": "file",
      "outputDir": "/batch_output/webp_converted",
      "quality": 80
    }
  }
}
```

## 注意事项

1. **权限检查**：确保对指定路径有写入权限
2. **路径格式**：支持相对路径和绝对路径
3. **文件覆盖**：如果指定的文件已存在，会被覆盖
4. **跨平台**：路径分隔符会自动处理（Windows的`\`和Unix的`/`）

## 返回值

无论使用哪种方式，都会返回处理后图片的**绝对路径**：

```json
{
  "content": [
    {
      "type": "text", 
      "text": "{\"originalFormat\":\"png\",\"targetFormat\":\"webp\",\"originalSize\":1024,\"convertedSize\":512,\"data\":\"/absolute/path/to/converted/image.webp\",\"metadata\":{\"width\":800,\"height\":600,\"quality\":90}}"
    }
  ]
}
```

这样用户就能准确知道文件保存在哪里，并且可以直接使用这个路径访问文件。