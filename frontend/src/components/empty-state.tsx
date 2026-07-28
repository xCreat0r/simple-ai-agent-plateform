import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center", className)}>
      <div className="mb-4 text-neutral-400">{icon}</div>
      <h3 className="mb-1 text-lg font-semibold text-neutral-900">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-neutral-500">{description}</p>
      {action}
    </div>
  );
}
