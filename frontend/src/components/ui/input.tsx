import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 border border-void-border bg-void-surface-2/50 px-3 py-3 text-base text-void-text transition-colors outline-none placeholder:text-void-dim focus-visible:border-void-accent focus-visible:ring-2 focus-visible:ring-void-accent/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-void-danger aria-invalid:ring-2 aria-invalid:ring-void-danger/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
