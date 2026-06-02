import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownScrollArea } from "@/components/ui/dropdown-scroll-area";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  addCommaSeparatedValue,
  removeCommaSeparatedValue,
  splitCommaSeparatedValues,
} from "@/lib/comma-separated-values";
import { cn } from "@/lib/utils";

type CourseMultiComboboxProps = {
  id?: string;
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

export function CourseMultiCombobox({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Digite ou escolha os cursos",
  disabled = false,
  className,
  emptyMessage = "Nenhum curso encontrado.",
}: CourseMultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [contentWidth, setContentWidth] = useState<number>();
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCourses = useMemo(() => splitCommaSeparatedValues(value), [value]);
  const normalizedSelectedCourses = useMemo(
    () => new Set(selectedCourses.map(normalize)),
    [selectedCourses],
  );
  const normalizedOptions = useMemo(
    () =>
      Array.from(new Map(options.map((option) => [normalize(option), option.trim()])).values())
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right)),
    [options],
  );
  const filteredOptions = useMemo(() => {
    const normalizedFilter = normalize(filter);
    if (!normalizedFilter) return normalizedOptions;

    return normalizedOptions.filter((option) => normalize(option).includes(normalizedFilter));
  }, [filter, normalizedOptions]);
  const canUseCustomValue =
    filter.trim().length > 0 &&
    !normalizedOptions.some((option) => normalize(option) === normalize(filter)) &&
    !normalizedSelectedCourses.has(normalize(filter));
  const selectableOptions = useMemo(
    () => [
      ...(canUseCustomValue ? [{ value: filter.trim(), isCustom: true }] : []),
      ...filteredOptions.map((option) => ({ value: option, isCustom: false })),
    ],
    [canUseCustomValue, filter, filteredOptions],
  );

  useEffect(() => {
    if (!open) return;

    setContentWidth(anchorRef.current?.getBoundingClientRect().width);
  }, [open]);

  const closeSuggestions = () => {
    setOpen(false);
    setFilter("");
    setActiveOptionIndex(0);
  };

  const openSuggestions = () => {
    if (disabled) return;
    setOpen(true);
  };

  const addCourse = (course: string) => {
    onValueChange(addCommaSeparatedValue(value, course));
    setFilter("");
    setActiveOptionIndex(0);
    setOpen(true);
  };

  const removeCourse = (course: string) => {
    onValueChange(removeCommaSeparatedValue(value, course));
  };

  const toggleCourse = (course: string) => {
    if (normalizedSelectedCourses.has(normalize(course))) {
      removeCourse(course);
      return;
    }

    addCourse(course);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setFilter("");
          setActiveOptionIndex(0);
        }
      }}
    >
      <PopoverAnchor asChild>
        <div
          ref={anchorRef}
          className={cn(
            "flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            disabled && "cursor-not-allowed opacity-50",
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {selectedCourses.map((course) => (
            <span
              key={normalize(course)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              {course}
              <button
                type="button"
                aria-label={`Remover curso ${course}`}
                className="rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  removeCourse(course);
                  inputRef.current?.focus();
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            id={id}
            ref={inputRef}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value);
              setActiveOptionIndex(0);
              setOpen(true);
            }}
            onFocus={openSuggestions}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setOpen(true);
                setActiveOptionIndex((current) => Math.max(0, Math.min(current + 1, selectableOptions.length - 1)));
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setOpen(true);
                setActiveOptionIndex((current) => Math.max(current - 1, 0));
              }

              if (event.key === "Enter" && selectableOptions[activeOptionIndex]) {
                event.preventDefault();
                const option = selectableOptions[activeOptionIndex];
                if (option.isCustom) {
                  addCourse(option.value);
                } else {
                  toggleCourse(option.value);
                }
              } else if (event.key === "," && filter.trim()) {
                event.preventDefault();
                addCourse(filter);
              }

              if (event.key === "Backspace" && !filter && selectedCourses.length > 0) {
                removeCourse(selectedCourses[selectedCourses.length - 1]);
              }

              if (event.key === "Escape") {
                event.preventDefault();
                closeSuggestions();
              }
            }}
            placeholder={selectedCourses.length ? "" : placeholder}
            disabled={disabled}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={
              open && selectableOptions[activeOptionIndex]
                ? `${listboxId}-option-${activeOptionIndex}`
                : undefined
            }
            className="h-7 min-w-36 flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 shrink-0"
            aria-label="Mostrar opções de curso"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              if (open) {
                closeSuggestions();
                return;
              }

              openSuggestions();
              inputRef.current?.focus();
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
        <DropdownScrollArea>
          <div
            id={listboxId}
            role="listbox"
            aria-label="Cursos relacionados"
            aria-multiselectable="true"
            className="max-h-[300px] p-1"
          >
            {selectableOptions.length > 0 ? (
              selectableOptions.map((option, index) => {
                const isSelected =
                  !option.isCustom && normalizedSelectedCourses.has(normalize(option.value));

                return (
                  <button
                    key={`${option.isCustom ? "custom" : "course"}-${option.value}`}
                    id={`${listboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground",
                      activeOptionIndex === index && "bg-accent text-accent-foreground",
                    )}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveOptionIndex(index)}
                    onClick={() => {
                      if (option.isCustom) {
                        addCourse(option.value);
                      } else {
                        toggleCourse(option.value);
                      }
                    }}
                  >
                    {option.isCustom ? (
                      <Plus className="mr-2 h-4 w-4" />
                    ) : (
                      <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    )}
                    {option.isCustom ? `Adicionar "${option.value}"` : option.value}
                  </button>
                );
              })
            ) : (
              <div className="p-3 text-sm text-muted-foreground">{emptyMessage}</div>
            )}
          </div>
        </DropdownScrollArea>
      </PopoverContent>
    </Popover>
  );
}
