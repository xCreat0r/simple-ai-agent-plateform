import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ToolForm } from "@/components/tools/tool-form";

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
      <h1 className="text-lg font-medium mb-6">编辑工具</h1>
      <ToolForm tool={tool as unknown as ToolData} />
    </div>
  );
}

interface ToolData {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}
