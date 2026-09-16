# Docker 部署

服务器项目路径：`/opt/tactic-weaver`。独立 Compose 服务接入已有的 `gateway` 网络。

```sh
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:4173/api/status
```

如 Docker Hub 访问受限，可在服务器 `.env` 设置 `NODE_IMAGE=m.daocloud.io/docker.io/library/node:22-slim`。如需模型服务，在同一个 `.env` 中配置 `DEEPSEEK_API_KEY` 和 `DEEPSEEK_MODEL`，随后运行 `docker compose up -d`；不要提交密钥。

`deploy/Caddyfile.snippet` 应合并到已有网关 Caddyfile，再热加载 Caddy。域名 A 记录：`play.sakuta.work` → `124.223.70.159`。本服务只发布宿主机回环端口 4173，对外访问通过 Caddy。

镜像构建会生成网页发布文件；服务使用 Node 22 和非 root 用户，独立健康检查、内存限制与日志轮换。技能、存档仍在浏览器运行，未配置模型密钥时返回明确的本地演示模式。

当前网关位于 `/opt/recipe-planner/go_backend`，容器名为 `go_backend-web-1`。上线时应备份 Caddyfile 与 Compose 文件，只增加游戏站点，保留其他站点配置。

## 本次部署记录（2026-09-16）

- 容器 `tactic-weaver-tactic-weaver-1`：healthy，重启次数 0。
- Docker 镜像构建（含 TypeScript 检查与 Vite 构建）成功；未运行测试套件。
- 本机首页、司祭图片均返回 HTTP 200；状态 API、辅助战术编译 API 正常。
- Caddy 容器可通过 gateway 网络访问 `tactic-weaver:4173`。
- 游戏域名已写入网关 Caddyfile，语法检查及热加载成功。Compose 增加 Caddyfile 只读挂载，下次重建网关时继续使用此文件。
- 原配置备份在服务器 `/opt/tactic-weaver/.deployment/gateway-backup-20260916-114723`，该目录排除在 Docker 构建上下文之外。
- 按用户要求未验证域名 DNS／公网 HTTPS。等待用户添加 DNS，Caddy 将自动尝试签发证书。
- 当前为本地演示模式，未配置 DeepSeek 密钥。
