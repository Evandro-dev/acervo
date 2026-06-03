import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SiteContainerProps {
  children: ReactNode;
  className?: string;
}

export function SiteContainer({ children, className }: SiteContainerProps) {
  return <div className={cn("mx-auto w-full max-w-360 px-4 md:px-6 xl:px-8", className)}>{children}</div>;
}
