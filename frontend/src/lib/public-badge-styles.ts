import { cn } from "@/lib/utils";

export const publicBadgeBaseClassName =
  "inline-flex min-h-5 max-w-full items-center gap-1 rounded-full border px-2 text-[10px] font-medium leading-tight shadow-[0_1px_2px_rgba(15,23,42,0.06)]";

export const publicBadgeMutedClassName =
  "border-border/70 bg-background text-foreground/75";

export const publicBadgeTypeClassName =
  "border-transparent bg-muted text-foreground/80 shadow-none";

export const publicBadgeStrongClassName =
  "border-border/75 bg-background text-foreground/85";

export const publicBadgeSuccessClassName =
  "border-0 bg-success/15 text-success shadow-none";

export const publicBadgeWarningClassName =
  "border-0 bg-warning/15 text-warning shadow-none";

export function publicBadgeClassName(className?: string) {
  return cn(publicBadgeBaseClassName, className);
}

export function publicMutedBadgeClassName(className?: string) {
  return cn(publicBadgeBaseClassName, publicBadgeMutedClassName, className);
}

export function publicTypeBadgeClassName(className?: string) {
  return cn(publicBadgeBaseClassName, publicBadgeTypeClassName, className);
}

export function publicStrongBadgeClassName(className?: string) {
  return cn(publicBadgeBaseClassName, publicBadgeStrongClassName, className);
}

export function publicSuccessBadgeClassName(className?: string) {
  return cn(publicBadgeBaseClassName, publicBadgeSuccessClassName, className);
}

export function publicWarningBadgeClassName(className?: string) {
  return cn(publicBadgeBaseClassName, publicBadgeWarningClassName, className);
}
