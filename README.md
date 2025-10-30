# Niu-Ma-Tools

Niu-Ma-Tools 是一个保持原有 UI 体验的音视频小工具集合。后端已经迁移到 Docker 化的 Hono Node 服务，镜像内同时包含前端静态资
源与后端 API，并预装原生 `ffmpeg`，方便扩展更多音视频处理能力。

## 快速开始

### 本地前端开发
```bash
npm install
npm run dev          # 前端开发模式（Vite）
```

### 生产构建
```bash
npm run build        # 构建前端静态资源（输出到 dist/）
```

### Docker 部署（单镜像）
```bash
docker build -t niu-ma-tools .
docker run -d \
  -p 8787:8787 \
  -e APP_NAME="Niu Ma Tools" \
  -v $(pwd)/app-logs:/data/logs \
  --name niu-ma-tools \
  niu-ma-tools
# 应用默认运行在 http://localhost:8787
```

容器启动时会自动构建前端静态资源，并运行 Node 服务来同时提供页面与 API。挂载的 `app-logs` 目录用于持久化后端日志，便于在宿主机
上查看或备份。

## 技术栈
- [Hono](https://hono.dev/)（Node 运行时）作为后端框架
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) 构建前端
- [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) 提供样式与动效
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) 在浏览器端进行音频转码
- 原生 `ffmpeg` 通过 Docker 镜像提供，支持未来在后端执行更复杂的媒体处理

## 项目结构

```
Niu-Ma-Tools/
├─ server/
│  └─ index.mjs             # Node/Hono 后端入口
├─ src/
│  ├─ index.ts              # 旧 Worker 入口（保留以便参考）
│  ├─ routes/               # 原 Worker 路由实现
│  └─ web/                  # 前端源代码
├─ dist/                    # Vite 构建输出
├─ Dockerfile
└─ 其它配置文件
```

## GitHub Actions
仓库提供 `Build and Publish Docker image` 工作流（`.github/workflows/docker-image.yml`），在推送到 `main`、发布 Release 或手动触
发时，自动构建并推送镜像到 GitHub Packages（`ghcr.io/<owner>/niu-ma-tools`）。

## 许可证
MIT
