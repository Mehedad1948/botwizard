import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        brand:
          "bg-brand-pink text-white shadow-xl shadow-brand-pink/25 hover:-translate-y-1 hover:bg-brand-pink/90 hover:shadow-brand-pink/35 focus-visible:ring-brand-pink/30",
        "brand-dark":
          "bg-slate-950 text-white shadow-lg shadow-brand-lilac/20 hover:-translate-y-0.5 hover:bg-brand-pink focus-visible:ring-brand-lilac/30",
        "brand-outline":
          "border-slate-200 bg-white text-slate-700 hover:border-brand-cyan hover:bg-brand-cyan/10 hover:text-slate-950 focus-visible:ring-brand-cyan/30",
        "brand-ghost":
          "text-slate-500 hover:bg-brand-lilac/10 hover:text-brand-lilac focus-visible:ring-brand-lilac/30",
        glass:
          "border-white/80 bg-gradient-to-br from-white/80 via-white/45 to-brand-lilac/15 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_30px_rgba(90,45,120,0.12)] ring-1 ring-slate-900/8 backdrop-blur-xl backdrop-saturate-150 hover:-translate-y-0.5 hover:border-white hover:from-white/90 hover:via-white/60 hover:to-brand-cyan/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_14px_34px_rgba(90,45,120,0.16)] focus-visible:ring-brand-lilac/35 dark:border-white/20 dark:from-white/15 dark:via-white/10 dark:to-brand-lilac/15 dark:text-white dark:ring-white/10",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        "brand-sm": "h-10 gap-2 rounded-full px-5 text-sm font-bold",
        brand: "h-13 gap-3 rounded-2xl px-7 text-sm font-black",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
