import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type FilterSheetContentProps = {
  children: ReactNode;
  description: string;
  onApply: () => void;
  onClear: () => void;
  title?: string;
};

export function FilterSheetContent({
  children,
  description,
  onApply,
  onClear,
  title = "Filtros",
}: FilterSheetContentProps) {
  return (
    <SheetContent
      side="bottom"
      className="h-[92vh] overflow-y-auto rounded-t-[28px] border-0 bg-white px-5 pb-6 pt-4 shadow-2xl md:bottom-auto md:left-1/2 md:right-auto md:top-1/2 md:h-auto md:max-h-[90vh] md:w-[min(92vw,720px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
    >
      <SheetHeader className="mb-6 flex flex-row items-center justify-between space-y-0 text-left">
        <SheetTitle className="text-2xl font-bold text-[#E30613]">{title}</SheetTitle>
        <SheetDescription className="sr-only">{description}</SheetDescription>
      </SheetHeader>

      {children}

      <SheetFooter className="mt-8 grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          className="h-12 rounded-xl border-zinc-300 text-base font-semibold"
          onClick={onClear}
        >
          Limpar
        </Button>
        <Button
          className="h-12 rounded-xl bg-linear-to-r from-[#E30613] to-[#B00010] text-base font-semibold text-white hover:opacity-90"
          onClick={onApply}
        >
          Aplicar filtros
        </Button>
      </SheetFooter>
    </SheetContent>
  );
}
