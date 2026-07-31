# ECS 部署指南（Docker）

在云服务器（如阿里云 ECS）上通过 Docker 部署 `base-service` 镜像。

## 部署架构

```
用户请求
  │
  └── https://your-domain.com:28080 (ECS 安全组放行)
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

```bash
docker run -d \
  --name base-service \
  --restart unless-stopped \
  -p 28080:8080 \
  -e PORT=8080 \
  crpi-ga7cj49iwn8ptcyv.cn-guangzhou.personal.cr.aliyuncs.com/xmaker513/base-service:latest
```

| 参数 | 说明 |
|------|------|
| `-d` | 后台运行 |
| `--restart unless-stopped` | 崩溃自动重启，开机自启 |
| `-p 28080:8080` | 宿主机 28080 端口映射到容器 8080 |
| `-e PORT=8080` | 容器内监听端口（可选，默认即 8080） |

---

## 第四步：验证服务

```bash
# 查看容器状态
docker ps | grep base-service

# 查看日志
docker logs -f base-service

# 健康检查
curl http://localhost:28080/health
# 预期: {"status":"ok"}
```

---

## 第五步：安全组放行端口

在云厂商控制台（阿里云 ECS → 安全组）添加入方向规则：

| 协议 | 端口 | 源 | 用途 |
|------|------|-----|------|
| TCP | 28080 | 0.0.0.0/0 | 对外服务 |
| TCP | 22 | 你的 IP | SSH（仅运维） |

> 建议将 28080 端口源限制为具体调用方 IP 或通过反向代理（Nginx）暴露。

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

# 3. 重新运行（复用第三步的命令）
docker run -d \
  --name base-service \
  --restart unless-stopped \
  -p 28080:8080 \
  -e PORT=8080 \
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
- [ ] `curl http://localhost:28080/health` 返回 `{"status":"ok"}`
- [ ] 安全组 28080 端口已放行，外部可访问
- [ ] `--restart unless-stopped` 已生效（重启服务器后容器自动拉起）
- [ ] 大陆与海外 ECS 均可从 ACR 正常拉取镜像
