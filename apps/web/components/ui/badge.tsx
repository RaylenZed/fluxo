import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[6px] px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "bg-[var(--brand-100)] text-[var(--brand-700)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-300)]",
        secondary: "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
        destructive: "bg-red-500/10 text-red-700 dark:text-red-400",
        outline: "border border-[var(--border)] text-[var(--muted)]",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
