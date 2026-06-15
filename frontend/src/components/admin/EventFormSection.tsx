import type { ReactNode } from "react";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type FormAccordionSectionProps = {
  children: ReactNode;
  description?: string;
  title: string;
  value: string;
};

export function FormAccordionSection({
  children,
  description,
  title,
  value,
}: FormAccordionSectionProps) {
  return (
    <AccordionItem
      value={value}
      className="-mx-4 overflow-hidden border-y border-border/60 bg-card shadow-none transition-colors hover:border-[#d00012]/25 data-[state=open]:border-border/70 sm:mx-0 sm:rounded-2xl sm:border sm:shadow-card"
    >
      <AccordionTrigger className="group relative bg-background px-4 py-4 text-left transition-colors after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border/60 hover:bg-muted/30 hover:no-underline">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 z-10 h-0.5 w-0 bg-[#d00012] transition-[width] duration-300 ease-out group-hover:w-1/2 group-data-[state=open]:w-full group-data-[state=open]:group-hover:w-full"
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold text-[#d00012]">{title}</span>

          {description ? (
            <span className="text-xs font-normal leading-relaxed text-muted-foreground">
              {description}
            </span>
          ) : null}
        </div>
      </AccordionTrigger>

      <AccordionContent className="bg-card px-4 pb-4 pt-4">
        <div className="flex flex-col gap-4">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
      {children}
    </div>
  );
}