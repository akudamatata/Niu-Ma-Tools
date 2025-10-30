# Niu-Ma-Tools

Niu-Ma-Tools 是一个部署在 Cloudflare Workers 上的音频工具集合。第一阶段提供「在线音频转 MP3」功能，后续将扩展更多音频 / 视频工具。

## 快速开始

```bash
npm install
npm run dev          # 前端开发模式（Vite）
npm run build        # 构建前端静态资源
wrangler dev         # 本地 Worker 调试
wrangler deploy      # 部署到 Cloudflare
```

## 技术栈
- [Hono](https://hono.dev/) 作为 Worker 端框架
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) 构建前端
- [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) 提供样式与动效
- [@ffmpeg/ffmpeg](https://github.com/ffmpegwasm/ffmpeg.wasm) 在浏览器端进行音频转码
- [Zustand](https://github.com/pmndrs/zustand) 管理转换状态

## 项目结构

```
Niu-Ma-Tools/
├─ src/
│  ├─ index.ts                 # Worker 入口
│  ├─ routes/
│  │  ├─ home.ts               # 首页与工具页面渲染
│  │  ├─ api.ts                # API 路由（日志等）
│  │  └─ static.ts             # 静态资源兜底路由
│  ├─ utils/
│  │  └─ response.ts           # 静态资源响应封装
│  └─ web/                     # 前端源代码
│     ├─ index.html
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ index.css
│     ├─ components/
│     ├─ features/
│     │  └─ audio-convert/     # 音频转 MP3 功能
│     ├─ store/
│     └─ lib/
├─ dist/                       # Vite 构建输出（部署到 Workers）
├─ wrangler.toml
└─ 其它配置文件
```

## 部署提示
1. 构建前端：`npm run build`
2. 使用 Wrangler 部署 Worker：`wrangler deploy`
3. 如需启用 KV、R2 或 Workers AI，请在 `wrangler.toml` 中配置对应 binding。

## 许可证
MIT
