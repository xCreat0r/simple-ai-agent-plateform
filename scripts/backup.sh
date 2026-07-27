#!/bin/bash
# 数据库备份脚本
# 用法: ./scripts/backup.sh

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/agent_platform_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "开始备份数据库..."
pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
echo "备份完成: $BACKUP_FILE"

# 保留最近 7 天的备份
find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
echo "已清理过期备份"
