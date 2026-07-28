/**
 * 管理员账号创建脚本
 * 使用方法：
 *   开发环境: npx wrangler d1 execute agent-platform-db --local --command="INSERT INTO users (id, name, email, email_verified, created_at, updated_at) VALUES ('admin-id', '管理员', 'admin@example.com', 1, strftime('%s','now')*1000, strftime('%s','now')*1000);"
 *   生产环境: npx wrangler d1 execute agent-platform-db --remote --command="..."

 * 或者通过 API 注册：启动应用后访问 /signup 创建管理员账号
 */

const email = process.env.SEED_EMAIL || "admin@example.com";
const password = process.env.SEED_PASSWORD || "changeme123";
const adminName = process.env.SEED_NAME || "管理员";

console.log("管理员账号配置:");
console.log(`  邮箱: ${email}`);
console.log(`  密码: ${password}`);
console.log(`  名称: ${adminName}`);
console.log("");
console.log("请通过应用注册页面 /signup 创建管理员账号");
console.log("或使用 wrangler d1 execute 直接插入用户数据");
