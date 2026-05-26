import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { tools as toolsTable } from "@/lib/db/schema";

export function ToolCard({ tool }: { tool: typeof toolsTable.$inferSelect }) {
  const params = tool.parameters as { type: "object"; properties: Record<string, unknown> };
  const paramCount = params?.properties ? Object.keys(params.properties).length : 0;

  return (
    <div className="border border-gray-200 rounded-lg px-4 py-3 flex items-start justify-between">
      <div>
        <p className="text-sm font-medium">{tool.name}</p>
        <p className="text-sm text-gray-500 mt-1">{tool.description || "无描述"}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">{tool.method}</Badge>
          <Badge variant="outline" className="text-xs">{paramCount} 个参数</Badge>
          <span className="text-xs text-gray-400 truncate max-w-[200px]">{tool.endpoint}</span>
        </div>
      </div>
      <Link
        href={`/tools/${tool.id}/edit`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        编辑
      </Link>
    </div>
  );
}
