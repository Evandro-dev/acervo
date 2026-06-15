import { Filter } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ComponentRef } from "react";
import { Button } from "@/components/ui/button";

type FilterButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  activeCount?: number;
  label: string;
};

export const FilterButton = forwardRef<
  ComponentRef<typeof Button>,
  FilterButtonProps
>(function FilterButton(
  { activeCount = 0, label, className, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      variant="secondary"
      size="icon"
      className={[
        "relative h-9 w-9 shrink-0 rounded-lg bg-brand-soft text-primary-dark hover:bg-brand-soft/80",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      {...props}
    >
      <Filter className="h-4 w-4" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-dark px-1 text-[10px] font-bold text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  );
});
