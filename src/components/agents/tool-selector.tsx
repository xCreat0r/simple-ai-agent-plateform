"use client";

import { getAllTools } from "@/lib/tools";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function ToolSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (toolIds: string[]) => void;
}) {
  const tools = getAllTools();

  function toggle(toolId: string) {
    if (selected.includes(toolId)) {
      onChange(selected.filter((id) => id !== toolId));
    } else {
      onChange([...selected, toolId]);
    }
  }

  if (tools.length === 0) {
    return <p className="text-sm text-gray-500">暂无可用工具</p>;
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <div key={tool.id} className="flex items-start gap-3 p-3 border rounded-lg border-gray-200">
          <Checkbox
            id={`tool-${tool.id}`}
            checked={selected.includes(tool.id)}
            onCheckedChange={() => toggle(tool.id)}
          />
          <div className="flex-1">
            <Label htmlFor={`tool-${tool.id}`} className="text-sm font-medium cursor-pointer">
              {tool.name}
            </Label>
            <p className="text-xs text-gray-500 mt-1">{tool.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
