"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"
import { useSettings } from "@/hooks/use-settings"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useSettings((s) => s.theme)

  // Map our internal theme preference ("light" | "dark" | "system") to
  // Sonner's accepted values. We avoid pulling in next-themes to keep the
  // theme state in our own Zustand store.
  const resolved: ToasterProps["theme"] =
    theme === "system" ? "system" : theme

  return (
    <Sonner
      theme={resolved}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      position="top-center"
      richColors
      {...props}
    />
  )
}

export { Toaster }
