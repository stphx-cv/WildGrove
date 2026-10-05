import { LineIcon, type IconProps } from "./LineIcon"

/** Ticket with a dashed line down each side. */
export function TicketDashedIcon(props: IconProps) {
    return (
        <LineIcon {...props}>
            <path d="M16.5 6v.75m0 3v.75m0 3v.75M4.5 6v.75m0 3v.75m0 3v.75m9-9H5.25A2.25 2.25 0 003 8.25v.75a3 3 0 000 6v.75a2.25 2.25 0 002.25 2.25H16.5m0-13.5h3.375c.621 0 1.125.504 1.125 1.125V19.5c0 .621-.504 1.125-1.125 1.125H16.5m-13.5 0V8.25m13.5 0v9.75" />
        </LineIcon>
    )
}
