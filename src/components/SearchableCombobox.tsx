import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";

export type SearchableComboboxItem = {
  value: string;
  label: string;
  subLabel?: string;
  /** Texto usado para busca (se omitido, usa label + subLabel) */
  searchText?: string;
};

type Props = {
  items: SearchableComboboxItem[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
};

export function SearchableCombobox({
  items,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado.",
  disabled,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const selected = React.useMemo(
    () => items.find((i) => i.value === value),
    [items, value],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <span className="ml-2 flex items-center gap-1">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onValueChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onValueChange("");
                  }
                }}
                aria-label="Limpar seleção"
                title="Limpar"
              >
                <X className="h-4 w-4" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-60" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={(item.searchText ?? `${item.label} ${item.subLabel ?? ""}`).trim()}
                  onSelect={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{item.label}</span>
                    {item.subLabel ? (
                      <span className="truncate text-xs text-muted-foreground">{item.subLabel}</span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            {value ? (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__clear__"
                    onSelect={() => {
                      onValueChange("");
                      setOpen(false);
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpar seleção
                  </CommandItem>
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
