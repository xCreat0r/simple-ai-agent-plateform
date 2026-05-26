import { ToolForm } from "@/components/tools/tool-form";

export default function NewToolPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-lg font-medium mb-6">新建工具</h1>
      <ToolForm />
    </div>
  );
}
