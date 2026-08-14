# ECS 部署指南（Docker）

> ⚠️ **已停用（保留参考）**：自 2026-08 起 PDF 解析改为 Worker 内本地解析（`unpdf`，见 `backend/src/lib/ai/pdf.ts`），不再部署/调用 base 服务。本文档仅作历史参考与回退方案（若未来重新启用，需同步 Worker 端 `BASE_SERVICE_*` secrets 与 PDF 密文配置）。

在云服务器（如阿里云 ECS）上通过 Docker 部署 `base-service` 镜像。

## 部署架构

```
用户请求
  │
  └── https://your-domain.com:38080 (ECS 安全组放行)
        └── Docker 容器 (crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service)
              └── POST /doc-parser/parse — PDF 文本提取
              └── GET  /health           — 健康检查
```

---

## 前置依赖

1. **ECS 实例** — 建议 2C4G 及以上（PDF 解析较耗 CPU/内存）
2. **Docker Engine** — v20.10+（支持多架构镜像拉取）
3. **镜像已发布** — 通过 GitHub Actions `workflow_dispatch` 构建并推送到阿里云 ACR `crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service`

---

## 第一步：安装 Docker

如果服务器上还未安装 Docker：

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

验证：

```bash
docker version
```

---

## 第二步：拉取镜像

镜像存放在阿里云 ACR，中国大陆与海外地域均可直接拉取，无需配置镜像加速器。

```bash
docker pull crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service:latest
```

多架构镜像会自动匹配服务器架构（amd64 / arm64）。

---

## 第三步：运行容器

先准备鉴权配置文件 `/etc/base-service.env`：

```bash
# 生成密钥对并写入配置文件（key 为标识，secret 用 openssl 生成）
echo "BASE_SERVICE_KEYS=key1:$(openssl rand -base64 32)" > /etc/base-service.env
chmod 600 /etc/base-service.env
```

> **应用层加密（可选）**：若启用 PDF 密文传输，追加 `PDF_ENCRYPTION_KEY` 并保持与 Worker 端一致：
>
> ```bash
> PDF_KEY=$(openssl rand -base64 32)
> echo "PDF_ENCRYPTION_KEY=${PDF_KEY}" >> /etc/base-service.env
> # Worker 端需配置同一把: npx wrangler secret put PDF_ENCRYPTION_KEY
> ```
>
> 部署顺序要求：**先配置 base 服务（含新代码+密钥），再切 Worker（含新代码+密钥）**，避免空窗期明文/密文不匹配。

```bash
docker run -d \
  --name base-service \
  --restart unless-stopped \
  -p 38080:38080 \
  -e PORT=38080 \
  -v /etc/base-service.env:/app/.env \
  crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service:latest
```

> 服务为 Python FastAPI（uvicorn + PyMuPDF），启动时读取 `/app/.env` 中的 `BASE_SERVICE_KEYS`（也可用环境变量覆盖，优先级更高）。
> **鉴权机制：HMAC-SHA256 请求签名**（无 TLS 公网下不传输明文密钥）。请求携带 `X-Api-Key` / `X-Timestamp` / `X-Nonce` / `X-Signature` 四头；base 按 `X-Api-Key` 查对应 secret，校验时间戳窗口（±300s）+ nonce 去重（防重放）+ 签名比对。签名串：`{timestamp}\n{nonce}\n{sha256Hex(body)}\n{path}`。
> 校验失败返回 401；未配置 `BASE_SERVICE_KEYS` 返回 503（fail-closed）。**key/secret 必须与 Worker 端 `BASE_SERVICE_KEY` / `BASE_SERVICE_SECRET` 对应其中一组**。

| 参数 | 说明 |
|------|------|
| `-d` | 后台运行 |
| `--restart unless-stopped` | 崩溃自动重启，开机自启 |
| `-p 38080:38080` | 宿主机 38080 端口映射到容器 38080 |
| `-e PORT=38080` | 容器内监听端口（可选，Dockerfile CMD 已指定 38080，可不设） |
| `-v /etc/base-service.env:/app/.env` | 挂载鉴权配置文件（含 `BASE_SERVICE_KEYS=`，与 Worker 端一致） |

> 若用 systemd 方式（见下方"高级"），配置文件改为 `/etc/base-service.env` 由 `EnvironmentFile=` 直接读取，无需挂载。

### 密钥轮换（无中断）

1. **添加**：在 `/etc/base-service.env` 的 `BASE_SERVICE_KEYS` 追加新组 `,key2:<新secret>`，`docker restart base-service`
2. **切换**：Worker 端 `wrangler secret put BASE_SERVICE_KEY/BASE_SERVICE_SECRET` 换成新 key/secret（旧 key 在过渡期仍可验签）
3. **验证**：上传 PDF 确认新 key 生效
4. **移除**：从 `BASE_SERVICE_KEYS` 删除旧组，`docker restart base-service`

> `BASE_SERVICE_KEYS` 在服务启动时解析，修改后需重启容器。任何单个请求只携带一组 key/签名（Worker 侧单 key 签名，base 侧多 key 可验证）。

### 密钥泄露应急

> 若任一 secret（含 `services/base/.env.example` 中历史出现过的示例值）曾被提交到代码仓库或暴露，必须视为已泄露并立即轮换：
> 1. 用上面的无中断轮换流程把 Worker 与 base 服务切换到全新 secret
> 2. 涉及 git 历史时，用 `git filter-repo --replace-text <映射文件>` 重写历史删除旧值，备份后 `force-push`
> 3. 轮换后确认仓库中无任何真实 secret（`git grep -c <旧值>` 应无命中），模板文件一律使用 `your-secret-here` 占位符

---

## 第四步：验证服务

```bash
# 查看容器状态
docker ps | grep base-service

# 查看日志
docker logs -f base-service

# 健康检查
curl http://localhost:38080/health
# 预期: {"status":"ok"}
```

---

## 第五步：安全组放行端口

在云厂商控制台（阿里云 ECS → 安全组）添加入方向规则：

| 协议 | 端口 | 源 | 用途 |
|------|------|-----|------|
| TCP | 38080 | 0.0.0.0/0 | 对外服务 |
| TCP | 22 | 你的 IP | SSH（仅运维） |

> 建议将 38080 端口源限制为具体调用方 IP 或通过反向代理（Nginx）暴露。

---

## 常用运维命令

```bash
# 查看运行状态
docker ps -a

# 实时日志
docker logs -f base-service

# 停止/启动/重启
docker stop base-service
docker start base-service
docker restart base-service

# 进入容器
docker exec -it base-service sh

# 删除容器（先停止）
docker rm -f base-service
```

---

## 更新镜像

镜像发布新版后，按顺序执行：

```bash
# 1. 拉取最新镜像
docker pull crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service:latest

# 2. 删除旧容器
docker rm -f base-service

# 3. 重新运行（复用第三步的命令，确保 /etc/base-service.env 已配置）
docker run -d \
  --name base-service \
  --restart unless-stopped \
  -p 38080:38080 \
  -e PORT=38080 \
  -v /etc/base-service.env:/app/.env \
  crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service:latest
```

---

## 高级：systemd 方式（可选）

如果服务器同时管理多个服务，可用 `docker/base.service` 配合 systemd 管理。先将该文件复制到服务器：

```bash
cp docker/base.service /etc/systemd/system/base.service
systemctl daemon-reload
systemctl enable --now base
```

> systemd 方式需在 `docker/base.service` 中配置 Docker 网络，且 `ExecStart` 改为 `docker run ...` 或配合 compose 使用。

---

## 验证清单

- [ ] `docker ps` 显示 `base-service` 为 `Up` 状态
- [ ] `curl http://localhost:38080/health` 返回 `{"status":"ok"}`
- [ ] 无/错签名头调用 `/doc-parser/parse` 返回 401
- [ ] 正确签名调用 `/doc-parser/parse` 正常返回
- [ ] 同 nonce 重放请求返回 401；过期时间戳返回 401
- [ ] 安全组 38080 端口已放行，外部可访问
- [ ] `--restart unless-stopped` 已生效（重启服务器后容器自动拉起）
- [ ] 大陆与海外 ECS 均可从 ACR 正常拉取镜像
