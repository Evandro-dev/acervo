export const segmentedControlListClassName =
  "!grid !h-auto min-h-0 gap-1 overflow-hidden rounded-xl border border-border/60 bg-muted/35 p-1";

export const segmentedControlItemClassName =
  "inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:border-border focus-visible:ring-2 focus-visible:ring-[#d00012]/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const segmentedControlActiveItemClassName =
  "border-border bg-background text-[#d00012] shadow-[inset_0_0_0_1px_hsl(var(--border)),0_1px_2px_rgba(15,23,42,0.08)] hover:border-border hover:bg-background hover:text-[#d00012]";

export const segmentedControlInactiveItemClassName =
  "border-border/60 bg-muted/30 text-muted-foreground shadow-sm hover:border-border hover:bg-background/95 hover:text-foreground";

export const segmentedTabsTriggerClassName =
  "!h-auto data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-[#d00012] data-[state=active]:shadow-[inset_0_0_0_1px_hsl(var(--border)),0_1px_2px_rgba(15,23,42,0.08)] data-[state=active]:hover:border-border data-[state=active]:hover:bg-background data-[state=active]:hover:text-[#d00012] data-[state=inactive]:border-border/60 data-[state=inactive]:bg-muted/30 data-[state=inactive]:text-muted-foreground data-[state=inactive]:shadow-sm data-[state=inactive]:hover:border-border data-[state=inactive]:hover:bg-background/95 data-[state=inactive]:hover:text-foreground";
