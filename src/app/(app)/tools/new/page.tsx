import Link from "next/link";
import { ToolForm } from "@/components/tools/tool-form";

export default function NewToolPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/tools" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-block">
        ← 工具列表
      </Link>
      <h1 className="text-lg font-medium mb-6">新建工具</h1>
      <ToolForm />
    </div>
  );
}
