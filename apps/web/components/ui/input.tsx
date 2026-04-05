import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)]",
        "px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] focus:border-transparent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-150",
        className
      )}
      ref={ref}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
