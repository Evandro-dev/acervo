export function getBrandedNavigationItemStateClassName(isActive: boolean) {
  return isActive
    ? "bg-brand text-primary-foreground shadow-sm"
    : "text-foreground/70 hover:bg-muted";
}
