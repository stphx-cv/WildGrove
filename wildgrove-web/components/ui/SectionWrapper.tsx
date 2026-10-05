interface SectionWrapperProps {
    children: React.ReactNode
    className?: string
    animate?: boolean
    id?: string
}

export function SectionWrapper({
    children,
    className = "",
    animate = true,
    id,
}: SectionWrapperProps) {
    return (
        <section
            id={id}
            className={`section-padding ${className}`}
            {...(animate ? { "data-animate": "" } : {})}
        >
            <div className="content-wrapper">{children}</div>
        </section>
    )
}
