import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-md border border-line bg-bg px-3 py-2 text-base text-ink shadow-sm transition-[border-color,box-shadow] duration-200 ease-out placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(0.48_0.12_230)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
