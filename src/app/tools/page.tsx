import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { getAllBuiltinTools } from "@/lib/tools";
import { eq, desc } from "drizzle-orm";
import { ToolCard } from "@/components/tools/tool-card";

export default async function ToolsPage() {
  const user = getCurrentUser();

  const dbTools = await db
    .select()
    .from(tools)
    .where(eq(tools.userId, user.id))
    .orderBy(desc(tools.updatedAt));

  const builtinInfo = getAllBuiltinTools().map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium">工具</h1>
        <Link
          href="/tools/new"
          className={buttonVariants({ size: "sm" })}
        >
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Link>
      </div>

      <h2 className="text-sm font-medium text-gray-400 mb-2">内置工具</h2>
      <div className="grid gap-3 mb-6">
        {builtinInfo.map((t) => (
          <div
            key={t.id}
            className="border border-gray-200 rounded-lg px-4 py-3"
          >
            <p className="text-sm font-medium">{t.name}</p>
            <p className="text-sm text-gray-500 mt-1">{t.description}</p>
          </div>
        ))}
      </div>

      <h2 className="text-sm font-medium text-gray-400 mb-2">自定义工具</h2>
      {dbTools.length === 0 ? (
        <p className="text-sm text-gray-400 py-4">暂无自定义工具</p>
      ) : (
        <div className="grid gap-3">
          {dbTools.map((t) => (
            <ToolCard key={t.id} tool={t} />
          ))}
        </div>
      )}
    </div>
  );
}
