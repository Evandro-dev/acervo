import * as React from "react";
import { protectedImageInteractionProps } from "@/lib/protected-image";
import { cn } from "@/lib/utils";

type ProtectedImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "draggable" | "onDragStart" | "onContextMenu"
>;

export const ProtectedImage = React.forwardRef<HTMLImageElement, ProtectedImageProps>(
  ({ className, ...props }, ref) => (
    <img
      ref={ref}
      className={cn("select-none", className)}
      {...props}
      {...protectedImageInteractionProps}
    />
  ),
);

ProtectedImage.displayName = "ProtectedImage";
