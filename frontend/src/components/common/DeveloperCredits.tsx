import { useState } from "react";
import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeveloperCredits() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      aria-label="Creditos dos desenvolvedores"
      onBlur={() => setIsExpanded(false)}
      onClick={() => setIsExpanded((current) => !current)}
      className={cn(
        "fixed bottom-20 right-0 z-50 flex items-center overflow-hidden text-foreground transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:bottom-5",
        isExpanded
          ? "h-[4.5rem] w-[18.25rem] max-w-[calc(100vw-1rem)] rounded-full border border-border/70 bg-background/85 px-2.5 py-2 shadow-card backdrop-blur sm:h-16 sm:w-[19.75rem]"
          : "h-9 w-9 rounded-l-full rounded-r-none border border-primary/20 bg-background/70 p-0 shadow-[0_8px_18px_-12px_hsl(var(--primary)/0.55)] backdrop-blur",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center text-primary transition-all duration-300 ease-out",
          isExpanded ? "rounded-full bg-primary/10" : "rounded-l-full rounded-r-none bg-primary/8 drop-shadow-sm",
        )}
      >
        <Code2 className="h-[17px] w-[17px] transition-all duration-300" />
      </span>

      <span
        aria-hidden={!isExpanded}
        className={cn(
          "min-w-0 overflow-hidden text-left transition-all duration-300 ease-out",
          isExpanded ? "ml-2.5 max-w-[14rem] opacity-100 sm:max-w-[16.5rem]" : "ml-0 max-w-0 opacity-0",
        )}
      >
        <span className="block text-[10px] font-semibold uppercase leading-none text-muted-foreground">
          Desenvolvido por:
        </span>
        <span className="mt-1 block text-xs font-semibold leading-snug text-foreground">
          Lara Ferreira, Evandro Silva e Carlos Daniel Cabral.
        </span>
      </span>
    </button>
  );
}
