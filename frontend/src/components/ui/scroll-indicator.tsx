import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ScrollIndicatorProps = {
  viewport: HTMLElement | null;
  className?: string;
};

type ScrollMetrics = {
  isVisible: boolean;
  thumbHeight: number;
  thumbOffset: number;
};

const emptyMetrics: ScrollMetrics = {
  isVisible: false,
  thumbHeight: 0,
  thumbOffset: 0,
};
const trackInset = 4;
const minimumThumbHeight = 24;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getMetrics(viewport: HTMLElement): ScrollMetrics {
  const trackHeight = Math.max(viewport.clientHeight - trackInset * 2, 0);
  const maximumScrollTop = viewport.scrollHeight - viewport.clientHeight;

  if (maximumScrollTop <= 0 || trackHeight <= 0) {
    return emptyMetrics;
  }

  const thumbHeight = Math.min(
    trackHeight,
    Math.max(minimumThumbHeight, (viewport.clientHeight / viewport.scrollHeight) * trackHeight),
  );
  const maximumThumbOffset = trackHeight - thumbHeight;

  return {
    isVisible: true,
    thumbHeight,
    thumbOffset: maximumThumbOffset * (viewport.scrollTop / maximumScrollTop),
  };
}

export function ScrollIndicator({ viewport, className }: ScrollIndicatorProps) {
  const [metrics, setMetrics] = useState<ScrollMetrics>(emptyMetrics);
  const viewportRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef<{ pointerId: number; startY: number; startScrollTop: number } | null>(null);

  useEffect(() => {
    if (!viewport) return;

    viewportRef.current = viewport;
    let animationFrame: number | undefined;
    const update = () => setMetrics(getMetrics(viewport));
    const scheduleUpdate = () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    const mutationObserver = new MutationObserver(scheduleUpdate);

    scheduleUpdate();
    viewport.addEventListener("scroll", update);
    resizeObserver.observe(viewport);
    mutationObserver.observe(viewport, { childList: true, subtree: true });

    return () => {
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      viewport.removeEventListener("scroll", update);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      viewportRef.current = null;
    };
  }, [viewport]);

  if (!viewport || !metrics.isVisible) {
    return null;
  }

  const updateScrollFromThumbMovement = (movementY: number) => {
    const currentViewport = viewportRef.current;
    if (!currentViewport) return;

    const trackHeight = Math.max(currentViewport.clientHeight - trackInset * 2, 0);
    const availableThumbMovement = trackHeight - metrics.thumbHeight;
    const maximumScrollTop = currentViewport.scrollHeight - currentViewport.clientHeight;

    if (availableThumbMovement <= 0 || maximumScrollTop <= 0) return;

    currentViewport.scrollTop = clamp(
      (draggingRef.current?.startScrollTop ?? currentViewport.scrollTop) +
        (movementY / availableThumbMovement) * maximumScrollTop,
      0,
      maximumScrollTop,
    );
  };

  return (
    <div
      aria-hidden="true"
      data-slot="dropdown-scroll-indicator"
      className={cn("absolute inset-y-1 right-1 z-10 w-2 rounded-full bg-muted/70", className)}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return;

        const currentViewport = viewportRef.current;
        if (!currentViewport) return;

        const trackBounds = event.currentTarget.getBoundingClientRect();
        const desiredThumbOffset = event.clientY - trackBounds.top - metrics.thumbHeight / 2;
        const availableThumbMovement = trackBounds.height - metrics.thumbHeight;
        const maximumScrollTop = currentViewport.scrollHeight - currentViewport.clientHeight;

        currentViewport.scrollTop =
          availableThumbMovement > 0
            ? clamp((desiredThumbOffset / availableThumbMovement) * maximumScrollTop, 0, maximumScrollTop)
            : 0;
      }}
    >
      <div
        data-slot="dropdown-scroll-thumb"
        className="absolute left-0 right-0 cursor-grab rounded-full bg-muted-foreground/60 active:cursor-grabbing"
        style={{
          height: metrics.thumbHeight,
          transform: `translateY(${metrics.thumbOffset}px)`,
        }}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const currentViewport = viewportRef.current;
          if (!currentViewport) return;

          draggingRef.current = {
            pointerId: event.pointerId,
            startY: event.clientY,
            startScrollTop: currentViewport.scrollTop,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (draggingRef.current?.pointerId !== event.pointerId) return;
          updateScrollFromThumbMovement(event.clientY - draggingRef.current.startY);
        }}
        onPointerUp={(event) => {
          if (draggingRef.current?.pointerId !== event.pointerId) return;
          draggingRef.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          draggingRef.current = null;
        }}
      />
    </div>
  );
}
