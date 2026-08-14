import postgres from "postgres";

// 存量邮箱规范化脚本：把 users 表中非小写/含首尾空白的邮箱统一为小写。
// 遇大小写重复（规范化后冲突）则跳过并提示，需人工处理。
// 用法: DATABASE_URL="postgres://..." tsx scripts/normalize-emails.ts

const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/agent_platform";
const sql = postgres(dbUrl);

async function main() {
  const rows = await sql`SELECT id, email FROM users WHERE email IS NOT NULL AND email <> lower(btrim(email))`;
  if (rows.length === 0) {
    console.log("无需修正的邮箱");
    await sql.end();
    return;
  }

  let updated = 0;
  for (const r of rows) {
    const normalized = (r.email as string).trim().toLowerCase();
    const dup = await sql`SELECT id FROM users WHERE email = ${normalized} AND id <> ${r.id}`;
    if (dup.length > 0) {
      console.warn(`跳过: ${r.email} → ${normalized}（存在重复邮箱，需人工处理）`);
      continue;
    }
    await sql`UPDATE users SET email = ${normalized} WHERE id = ${r.id}`;
    console.log(`已规范化: ${r.email} → ${normalized}`);
    updated++;
  }
  console.log(`完成，共修正 ${updated} 条`);
  await sql.end();
}

main().catch((err) => {
  console.error("修正失败:", err);
  throw err;
});
