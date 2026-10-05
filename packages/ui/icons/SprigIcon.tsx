import { LineIcon, type IconProps } from "./LineIcon"

/** Sprig of three sage leaves: the seasonal menu. */
export function SprigIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M7 21C8.6 17.4 10.6 13.6 13.4 10.2" />
            <path d="M13.4 10.2C16.97 11.59 20.07 6.7 19.2 3.6C16.01 3.14 11.57 6.83 13.4 10.2Z" />
            <path d="M10.6 14.4C10.76 11.11 6.05 10.01 3.8 11.6C4.27 14.31 8.4 16.85 10.6 14.4Z" />
            <path d="M11.4 16.6C11.53 19.37 15.76 20.06 17.6 18.6C16.96 16.34 13.13 14.43 11.4 16.6Z" />
        </LineIcon>
    )
}
