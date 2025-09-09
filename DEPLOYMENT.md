# 🚀 Image Processor MCP Server 部署指南

## 📋 系统要求

### 基础环境
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **操作系统**: Windows, macOS, Linux

### 可选依赖
- **Python**: >= 3.8 (用于某些图片处理优化)
- **Visual Studio Build Tools**: Windows用户需要 (如果使用Canvas)

## 🛠️ 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url>
cd image-processor-mcp
```

### 2. 安装依赖

```bash
npm install
```

### 3. 构建项目

```bash
npm run build
```

### 4. 启动服务器

```bash
npm start
```

## 🔧 配置选项

### 环境变量

创建 `.env` 文件：

```env
# 日志级别 (DEBUG, INFO, WARN, ERROR)
LOG_LEVEL=INFO

# 输出目录
OUTPUT_DIR=./output

# 最大并发处理数
MAX_CONCURRENCY=5

# 网络请求超时 (毫秒)
REQUEST_TIMEOUT=30000

# 最大文件大小 (字节)
MAX_FILE_SIZE=10485760

# OCR默认语言
DEFAULT_OCR_LANGUAGE=chi_sim+eng
```

### 配置文件

创建 `config.json`：

```json
{
  "server": {
    "name": "image-processor-mcp",
    "version": "1.0.0",
    "maxConcurrency": 5
  },
  "processing": {
    "defaultQuality": 85,
    "maxImageSize": 10485760,
    "supportedFormats": ["jpg", "jpeg", "png", "webp", "avif", "gif", "bmp"]
  },
  "ocr": {
    "defaultLanguage": "chi_sim+eng",
    "timeout": 30000
  },
  "compression": {
    "defaultAlgorithm": "webp",
    "qualityRange": [10, 100]
  }
}
```

## 🐳 Docker 部署

### Dockerfile

```dockerfile
FROM node:18-alpine

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建项目
RUN npm run build

# 创建输出目录
RUN mkdir -p /app/output

# 设置权限
RUN chown -R node:node /app
USER node

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  image-processor-mcp:
    build: .
    ports:
      - "3000:3000"
    environment:
      - LOG_LEVEL=INFO
      - OUTPUT_DIR=/app/output
      - MAX_CONCURRENCY=3
    volumes:
      - ./output:/app/output
      - ./config:/app/config:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "process.exit(0)"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## ☁️ 云平台部署

### Vercel 部署

1. 安装 Vercel CLI：
```bash
npm i -g vercel
```

2. 创建 `vercel.json`：
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/dist/index.js"
    }
  ]
}
```

3. 部署：
```bash
vercel --prod
```

### Railway 部署

1. 创建 `railway.toml`：
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "npm start"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

2. 连接 GitHub 仓库并部署

### Heroku 部署

1. 创建 `Procfile`：
```
web: npm start
```

2. 部署命令：
```bash
heroku create your-app-name
git push heroku main
```

## 🔒 安全配置

### 1. 环境变量安全

```bash
# 生产环境变量
NODE_ENV=production
LOG_LEVEL=WARN
DISABLE_DEBUG=true
```

### 2. 网络安全

- 使用 HTTPS
- 配置 CORS
- 限制文件大小
- 验证图片格式

### 3. 资源限制

```javascript
// 在 index.ts 中添加
process.setMaxListeners(50);

// 内存限制
if (process.memoryUsage().heapUsed > 512 * 1024 * 1024) {
  console.warn('Memory usage high, consider restarting');
}
```

## 📊 监控和日志

### 1. 日志配置

```javascript
// 生产环境日志
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### 2. 性能监控

```javascript
// 添加性能监控
const performanceMonitor = {
  trackProcessingTime: (operation, startTime) => {
    const duration = Date.now() - startTime;
    console.log(`${operation} completed in ${duration}ms`);
  }
};
```

### 3. 健康检查

```javascript
// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});
```

## 🚨 故障排除

### 常见问题

1. **Sharp 安装失败**
```bash
npm rebuild sharp
```

2. **内存不足**
```bash
node --max-old-space-size=4096 dist/index.js
```

3. **权限问题**
```bash
sudo chown -R $USER:$USER ./output
```

4. **端口占用**
```bash
lsof -ti:3000 | xargs kill -9
```

### 调试模式

```bash
# 启用详细日志
DEBUG=* npm start

# 或者设置环境变量
LOG_LEVEL=DEBUG npm start
```

## 📈 性能优化

### 1. 缓存策略

```javascript
// Redis 缓存
const redis = require('redis');
const client = redis.createClient();

const cacheResult = async (key, data, ttl = 3600) => {
  await client.setex(key, ttl, JSON.stringify(data));
};
```

### 2. 集群部署

```javascript
// cluster.js
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
} else {
  require('./dist/index.js');
}
```

### 3. 负载均衡

使用 nginx 配置：

```nginx
upstream image_processor {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://image_processor;
    }
}
```

## 🔄 更新和维护

### 自动更新脚本

```bash
#!/bin/bash
# update.sh

echo "🔄 更新 Image Processor MCP Server..."

# 拉取最新代码
git pull origin main

# 安装依赖
npm ci

# 重新构建
npm run build

# 重启服务
pm2 restart image-processor-mcp

echo "✅ 更新完成！"
```

### 备份策略

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/image-processor-mcp"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份配置和输出
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" \
    config/ \
    output/ \
    .env

echo "✅ 备份完成: backup_$DATE.tar.gz"
```

---

**部署成功后，你的图片处理MCP服务器就可以为各种应用提供强大的图片处理能力了！** 🎉