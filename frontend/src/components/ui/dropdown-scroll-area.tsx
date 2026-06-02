import { useState, type ReactElement } from "react";
import { Slot } from "@radix-ui/react-slot";

import { ScrollIndicator } from "@/components/ui/scroll-indicator";
import { cn } from "@/lib/utils";

type DropdownScrollAreaProps = {
  children: ReactElement;
  className?: string;
  viewportClassName?: string;
  viewportSlot?: string;
};

export function DropdownScrollArea({
  children,
  className,
  viewportClassName,
  viewportSlot = "dropdown-scroll-viewport",
}: DropdownScrollAreaProps) {
  const [viewport, setViewport] = useState<HTMLElement | null>(null);

  return (
    <div data-slot="dropdown-scroll-area" className={cn("relative overflow-hidden", className)}>
      <Slot
        ref={setViewport}
        data-slot={viewportSlot}
        className={cn(
          "acervo-dropdown-scrollbar max-h-[300px] overflow-y-auto overflow-x-hidden pr-3",
          viewportClassName,
        )}
      >
        {children}
      </Slot>
      <ScrollIndicator viewport={viewport} />
    </div>
  );
}
