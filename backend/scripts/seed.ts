import postgres from "postgres";
import { hash } from "bcryptjs";

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

const email = env("SEED_EMAIL", "admin@example.com");
const password = env("SEED_PASSWORD", "changeme123");
const adminName = env("SEED_NAME", "管理员");
const dbUrl = env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/agent_platform");

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
  throw err;
});
