import { LineIcon, type IconProps } from "./LineIcon"

/** Glass with a straw: drinks. */
export function DrinksIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M5.5 7.5h13l-1.6 12.2a1.5 1.5 0 0 1-1.5 1.3H8.6a1.5 1.5 0 0 1-1.5-1.3Z" />
            <path d="M6.3 13h11.4" />
            <path d="M13 7.5 15.2 3H18" />
        </LineIcon>
    )
}
