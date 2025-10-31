# Niu-Ma-Tools

Niu-Ma-Tools 是一个保持原有 UI 体验的音视频/影像小工具集合，使用内置 Hono Node 服务同时提供前端静态页面与后端 API，并预装原生 `ffmpeg` 以扩展媒体处理能力。

## 自定义水印功能

项目现在内置了一个「今日水印」风格的图片处理工具，支持根据当前时间、日期、星期、温度以及用户填写的地点信息自动生成水印。

### 依赖准备

- 本机需安装 `python3` 以及 [`Pillow`](https://python-pillow.org/) 图像处理库：

  ```bash
  pip install pillow
  ```

- 将提供的字体文件 **汉仪旗黑X2-65W.ttf** 拷贝到 `assets/fonts/` 目录（仓库内的 `assets/fonts/README.txt` 提供了放置路径说明）。
- 将设计稿导出的黄色竖条资源（`separator.png`）放在 `assets/watermark/` 目录。生成器会在透明画布上直接绘制“今日水印 相机真实时间 防伪码”等文字标识，不再依赖单独的 logo 图片，确保水印可贴合到底图的任何区域。

### 本地运行示例

```bash
npm install
npm run build
PYTHON_EXECUTABLE=python3 npm start
```

启动后访问 `http://localhost:8787`，在首页的「自定义水印」模块中上传图片，即可生成带有日期、时间、温度、地点等信息的水印图片。生成接口为 `POST /api/watermark`，前端示例代码位于 `src/web/features/watermark/`，后端生成逻辑在根目录的 `watermark.py` 与 `server/index.mjs` 中。

## Docker Compose 部署

### docker-compose.yml
将以下内容保存为项目根目录下的 `docker-compose.yml`（仓库中已提供，可直接复制）：

```yaml
version: "3.9"

services:
  niu-ma-tools:
    build: .
    container_name: niu-ma-tools
    ports:
      - "8787:8787"
    environment:
      - APP_NAME=Niu Ma Tools
    volumes:
      - ./app-logs:/data/logs
    restart: unless-stopped
```

### 启动与停止
```bash
docker compose up -d    # 构建并启动服务
docker compose logs -f  # 查看实时日志
docker compose down     # 停止并移除容器
```

服务启动后会在 `http://localhost:8787` 提供 Web 页面与 API。容器会自动构建前端静态资源并启动 Node 服务，挂载的 `app-logs` 目录用于持久化后端日志，方便在宿主机查看或备份。

### 可用参数
- `APP_NAME`：页面显示的应用名称，可根据需要调整。
- `./app-logs:/data/logs`：宿主机与容器之间的日志目录映射，如不需要持久化可移除该行。

## 许可证
MIT
