#!/bin/bash
# D1 数据库备份脚本
# 用法: ./scripts/backup.sh
# 需要先登录 wrangler: npx wrangler login

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/agent_platform_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "开始备份 D1 数据库..."
npx wrangler d1 export agent-platform-db --output "$BACKUP_FILE"
echo "备份完成: $BACKUP_FILE"

# 保留最近 7 天的备份
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
echo "已清理过期备份"
