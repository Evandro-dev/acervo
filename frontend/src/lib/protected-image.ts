import type React from "react";

export function preventProtectedImageInteraction(event: React.SyntheticEvent) {
  event.preventDefault();
}

export const protectedImageInteractionProps = {
  draggable: false,
  onDragStart: preventProtectedImageInteraction,
  onContextMenu: preventProtectedImageInteraction,
} as const;
