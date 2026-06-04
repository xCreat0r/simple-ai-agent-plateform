"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface KB {
  id: string;
  name: string;
}

export function KnowledgeSelector({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (kbIds: string[]) => void;
}) {
  const [kbs, setKbs] = useState<KB[]>([]);

  useEffect(() => {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then(setKbs);
  }, []);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((i) => i !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  if (kbs.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        暂无知识库，
        <a href="/knowledge/new" className="text-blue-600 hover:underline">去创建</a>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {kbs.map((kb) => (
        <div key={kb.id} className="flex items-center gap-2">
          <Checkbox
            id={`kb-${kb.id}`}
            checked={selected.includes(kb.id)}
            onCheckedChange={() => toggle(kb.id)}
          />
          <Label htmlFor={`kb-${kb.id}`} className="text-sm cursor-pointer">{kb.name}</Label>
        </div>
      ))}
    </div>
  );
}
