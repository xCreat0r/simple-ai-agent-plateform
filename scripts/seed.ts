import { auth } from "../src/lib/auth";

async function main() {
  const email = process.env.SEED_EMAIL || "admin@example.com";
  const password = process.env.SEED_PASSWORD || "changeme123";
  const name = process.env.SEED_NAME || "管理员";

  try {
    await auth.api.signUpEmail({
      body: { email, password, name },
      headers: new Headers(),
    } as Parameters<typeof auth.api.signUpEmail>[0]);

    console.log(`管理员已创建: ${email}`);
  } catch (err: any) {
    if (err?.message?.includes("already") || err?.status === 422) {
      console.log(`管理员 "${email}" 已存在，跳过创建`);
    } else {
      console.error("创建管理员失败:", err?.message || err);
      process.exit(1);
    }
  }
}

main();
