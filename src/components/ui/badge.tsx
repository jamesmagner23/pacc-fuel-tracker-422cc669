import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-foreground",
        secondary: "border-transparent bg-muted text-foreground",
        destructive: "border-transparent bg-[#FBE5E2] text-[#8C2A1F]",
        outline: "border-border text-foreground bg-transparent",
        accent: "border-transparent bg-[rgba(200,242,106,0.35)] text-foreground",
        success: "border-transparent bg-[#E6F3E1] text-[#2A6A2E]",
        warning: "border-transparent bg-[#FFF4D9] text-[#7A5300]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
