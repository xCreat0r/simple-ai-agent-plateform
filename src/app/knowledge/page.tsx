import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Plus, Book } from "lucide-react";
import { db } from "@/lib/db";
import { knowledgeBases } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";
import { EmptyState } from "@/components/empty-state";

export default async function KnowledgePage() {
  const user = await getCurrentUser();
  const rows = await db
    .select()
    .from(knowledgeBases)
    .where(eq(knowledgeBases.userId, user.id))
    .orderBy(desc(knowledgeBases.createdAt));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/agents" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← Agent 列表
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-medium">知识库</h1>
        <Link href="/knowledge/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="w-4 h-4 mr-1" />
          新建
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Book}
          title="还没有知识库"
          description="上传文档创建知识库，Agent 可以从中检索信息"
          action={
            <Link href="/knowledge/new" className={buttonVariants({ size: "sm" })}>
              <Plus className="w-4 h-4 mr-1" />
              新建知识库
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((kb) => (
            <Link
              key={kb.id}
              href={`/knowledge/${kb.id}`}
              className="border border-gray-200 rounded-lg px-4 py-3 hover:shadow-sm transition-shadow"
            >
              <p className="text-sm font-medium">{kb.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(kb.createdAt).toLocaleDateString("zh-CN")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
