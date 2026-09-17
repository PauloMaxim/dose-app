import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[transform,filter,opacity] duration-150 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:size-4",
  {
    variants: {
      variant: {
        gradient: "btn-gradient shadow-[0_8px_24px_rgb(59_139_255/0.28)]",
        outline:
          "border border-blue/70 bg-transparent text-fg hover:bg-card-2",
        secondary: "bg-card-2 text-fg hover:bg-elevated",
        ghost: "text-muted hover:text-fg hover:bg-card",
        white: "bg-paper text-blue font-semibold",
      },
      size: {
        default: "h-12 px-5",
        sm: "h-9 px-3.5 text-xs",
        lg: "h-14 px-6 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "gradient",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & { asChild?: boolean }
>(({ className, variant, size, asChild = false, type, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
