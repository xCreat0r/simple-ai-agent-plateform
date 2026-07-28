import { Select as BaseSelect } from "@base-ui/react/select";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, Check } from "lucide-react";

interface SelectItem { value: string; label: string; }

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  items: SelectItem[];
  className?: string;
  disabled?: boolean;
}

function Select({ value, onValueChange, placeholder, items, className, disabled }: SelectProps) {
  return (
    <BaseSelect.Root value={value} onValueChange={(v) => v && onValueChange(v)} disabled={disabled}>
      <BaseSelect.Trigger
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
          className
        )}
      >
        <BaseSelect.Value placeholder={placeholder || "选择..."} />
        <BaseSelect.Icon className="ml-2 h-4 w-4 opacity-50">
          <ChevronsUpDown className="h-4 w-4" />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Backdrop />
        <BaseSelect.Popup className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-neutral-200 bg-white p-1 shadow-md">
          {items.map((item) => (
            <BaseSelect.Item
              key={item.value}
              value={item.value}
              className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-neutral-100 data-[highlighted]:text-neutral-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
            >
              <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
              <BaseSelect.ItemIndicator className="ml-auto h-4 w-4">
                <Check className="h-4 w-4" />
              </BaseSelect.ItemIndicator>
            </BaseSelect.Item>
          ))}
        </BaseSelect.Popup>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

export { Select };
export type { SelectItem, SelectProps };
