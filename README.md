# Niu-Ma-Tools

Niu-Ma-Tools 是一个保持原有 UI 体验的音视频小工具集合，使用内置 Hono Node 服务同时提供前端静态页面与后端 API，并预装原生 `ffmpeg` 以扩展媒体处理能力。

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
