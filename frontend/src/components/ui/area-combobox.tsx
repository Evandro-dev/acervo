import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type AreaComboboxProps = {
  value: string;
  options: string[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function AreaCombobox({
  value,
  options,
  onValueChange,
  placeholder = "Digite ou escolha uma área",
  disabled = false,
  className,
  emptyMessage = "Nenhuma área encontrada.",
}: AreaComboboxProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [contentWidth, setContentWidth] = useState<number>();
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions = useMemo(
    () =>
      Array.from(new Set(options.map((option) => option.trim()).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [options],
  );

  const filteredOptions = useMemo(() => {
    const normalizedFilter = normalize(filter);
    if (!normalizedFilter) return normalizedOptions;

    return normalizedOptions.filter((option) => normalize(option).includes(normalizedFilter));
  }, [filter, normalizedOptions]);

  const canUseCustomValue = filter.trim().length > 0 && !normalizedOptions.some((option) => normalize(option) === normalize(filter));

  useEffect(() => {
    if (!open) return;

    setContentWidth(anchorRef.current?.getBoundingClientRect().width);
  }, [open]);

  const closeSuggestions = () => {
    setOpen(false);
    setFilter("");
  };

  const openSuggestions = () => {
    if (disabled) return;
    setFilter("");
    setOpen(true);
  };

  const selectValue = (nextValue: string) => {
    onValueChange(nextValue.trim());
    closeSuggestions();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setFilter("");
      }}
    >
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              onValueChange(event.target.value);
              setFilter(event.target.value);
              setOpen(true);
            }}
            onFocus={openSuggestions}
            onClick={openSuggestions}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                openSuggestions();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                closeSuggestions();
              }

              if (event.key === "Enter" && open) {
                event.preventDefault();
                closeSuggestions();
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            className={cn("pr-10", className)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1 h-8 w-8"
            aria-label="Mostrar opções de área"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              if (open) {
                closeSuggestions();
                return;
              }

              openSuggestions();
            }}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        className="p-0"
        style={contentWidth ? { width: contentWidth } : undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onFocusOutside={(event) => {
          if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {canUseCustomValue || filteredOptions.length > 0 ? (
              <CommandGroup>
                {canUseCustomValue ? (
                  <CommandItem value={filter} onSelect={() => selectValue(filter)}>
                    <Check className={cn("mr-2 h-4 w-4", normalize(value) === normalize(filter) ? "opacity-100" : "opacity-0")} />
                    {`Usar "${filter.trim()}"`}
                  </CommandItem>
                ) : null}

                {filteredOptions.map((option) => (
                  <CommandItem key={option} value={option} onSelect={() => selectValue(option)}>
                    <Check className={cn("mr-2 h-4 w-4", normalize(value) === normalize(option) ? "opacity-100" : "opacity-0")} />
                    {option}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="p-3 text-sm text-muted-foreground">{emptyMessage}</div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
