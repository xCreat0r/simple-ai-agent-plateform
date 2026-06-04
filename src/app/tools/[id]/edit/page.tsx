import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ToolForm } from "@/components/tools/tool-form";
import type { ToolData } from "@/lib/types";

export default async function EditToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [tool] = await db.select().from(tools).where(eq(tools.id, id));
  if (!tool) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/tools" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← 工具列表
      </Link>
      <h1 className="text-lg font-medium mb-6">编辑工具</h1>
      <ToolForm tool={tool as unknown as ToolData} />
    </div>
  );
}
