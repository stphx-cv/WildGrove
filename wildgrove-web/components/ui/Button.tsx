import { Link } from "@/i18n/routing"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost"
    size?: "sm" | "md" | "lg"
    href?: string
}

const SIZE_CLASSES = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3 text-base",
} as const

const VARIANT_CLASSES = {
    primary:
        "bg-wg-accent hover:bg-wg-accent-hover text-white shadow-card hover:shadow-elevated dark:shadow-glow-sm dark:hover:shadow-glow-md",
    secondary:
        "border-2 border-wg-primary text-wg-primary hover:bg-wg-primary hover:text-white dark:border-wg-dark-primary dark:text-wg-dark-primary dark:hover:bg-wg-dark-primary dark:hover:text-wg-dark-bg",
    ghost:
        "text-wg-muted hover:text-wg-primary hover:bg-wg-border/30 dark:text-wg-dark-muted dark:hover:text-wg-dark-primary dark:hover:bg-wg-dark-border",
} as const

export function Button({
    variant = "primary",
    size = "md",
    href,
    className = "",
    children,
    ...props
}: ButtonProps) {
    const classes = `
    inline-flex items-center justify-center font-medium rounded-brand
    transition-all duration-200 ease-out
    hover:scale-[1.02] active:scale-[0.98]
    focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C17F3A]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
    ${SIZE_CLASSES[size]}
    ${VARIANT_CLASSES[variant]}
    ${className}
  `.trim()

    if (href) {
        return (
            <Link href={href} className={classes}>
                {children}
            </Link>
        )
    }

    return (
        <button className={classes} {...props}>
            {children}
        </button>
    )
}
