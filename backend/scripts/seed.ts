import postgres from "postgres";
import { hash } from "bcryptjs";

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;
const adminName = process.env.SEED_NAME;
if (!email || !password || !adminName) {
  console.error("请在 .env.local 中设置 SEED_EMAIL、SEED_PASSWORD、SEED_NAME");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("请在 .env.local 中设置 DATABASE_URL");
  process.exit(1);
}

const sql = postgres(dbUrl);

async function main() {
  const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existing) {
    console.log(`管理员账号已存在: ${email}`);
    await sql.end();
    return;
  }

  const id = crypto.randomUUID();
  const now = new Date();
  const passwordHash = await hash(password, 10);

  await sql`
    INSERT INTO users (id, name, email, email_verified, password_hash, provider, created_at, updated_at)
    VALUES (${id}, ${adminName}, ${email}, true, ${passwordHash}, 'email', ${now}, ${now})
  `;

  console.log("管理员账号创建成功:");
  console.log(`  邮箱: ${email}`);
  console.log(`  密码: ${password}`);
  console.log(`  名称: ${adminName}`);
  await sql.end();
}

main().catch((err) => {
  console.error("创建失败:", err);
  process.exit(1);
});
