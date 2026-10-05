import { hiddenFromReaders, type IconProps } from "./iconProps"

/** Filled tag with a white dot. The dot is white in both themes: it is the one color here that does not follow currentColor. */
export function TagSolidIcon(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden={hiddenFromReaders(props)} {...props}>
            <path d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.658.43l4.068-2.035a2.25 2.25 0 00.83-3.143L11.09 3.66A2.25 2.25 0 009.568 3z" />
            <path d="M6 6h.008v.008H6V6z" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
    )
}
