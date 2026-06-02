import type { ReactNode } from "react";
import {
  segmentedControlActiveItemClassName,
  segmentedControlItemClassName,
  segmentedControlListClassName,
} from "@/lib/segmented-control";
import { cn } from "@/lib/utils";

type SegmentedControlOption<T extends string> = {
  disabled?: boolean;
  label: ReactNode;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: T) => void;
  options: readonly SegmentedControlOption<T>[];
  value: T;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("grid", segmentedControlListClassName, className)}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            disabled={option.disabled}
            className={cn(segmentedControlItemClassName, isActive && segmentedControlActiveItemClassName)}
            onClick={() => onValueChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
