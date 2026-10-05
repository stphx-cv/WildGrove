import type { SVGProps } from "react"

// What every icon accepts: any attribute of an <svg> a use may need (className, strokeWidth,
// width, aria-label...). The base of each icon decides the rest.
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "ref">

/**
 * An icon with no name of its own is decoration, so it is hidden from screen readers.
 * A use that passes `aria-label`, `aria-labelledby` or `role` is naming it, and stays visible.
 */
export function hiddenFromReaders(props: IconProps): true | undefined {
    return props["aria-label"] === undefined && props["aria-labelledby"] === undefined && props.role === undefined ? true : undefined
}
