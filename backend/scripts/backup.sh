#!/bin/bash
# PostgreSQL 备份脚本（pg_dump，含 pgvector 扩展数据）
# 用法: DATABASE_URL="postgres://..." ./scripts/backup.sh
# 可选: BACKUP_DIR 指定备份目录（默认 ./backups）

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/agent_platform_${TIMESTAMP}.sql"

if [ -z "$DATABASE_URL" ]; then
  echo "错误: 请设置 DATABASE_URL 环境变量" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "开始备份 PostgreSQL 数据库..."
# --no-owner / --no-privileges：备份可跨库/跨用户恢复，避免属主报错
pg_dump --no-owner --no-privileges "$DATABASE_URL" > "$BACKUP_FILE"
echo "备份完成: $BACKUP_FILE"

# 保留最近 7 天的备份
find "$BACKUP_DIR" -name "agent_platform_*.sql" -mtime +7 -delete
echo "已清理过期备份"
