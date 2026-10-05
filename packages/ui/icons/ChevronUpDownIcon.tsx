import { LineIcon, type IconProps } from "./LineIcon"

/** Two chevrons, one up and one down: a sortable or selectable control. */
export function ChevronUpDownIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </LineIcon>
    )
}
