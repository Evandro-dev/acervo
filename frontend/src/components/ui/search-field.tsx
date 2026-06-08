import * as React from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchFieldProps extends React.ComponentProps<"input"> {
  containerClassName?: string;
  iconClassName?: string;
}

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      className,
      containerClassName,
      iconClassName,
      id,
      name,
      type = "search",
      "aria-label": ariaLabel = "Buscar",
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className={cn("relative", containerClassName)}>
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
            iconClassName,
          )}
        />
        <Input
          ref={ref}
          id={inputId}
          name={name ?? inputId}
          type={type}
          aria-label={ariaLabel}
          className={cn("pl-9", className)}
          {...props}
        />
      </div>
    );
  },
);
SearchField.displayName = "SearchField";

export { SearchField };
