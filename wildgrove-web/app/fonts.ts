// next/font loaders are module-scope calls. Two root-level documents need the
// same two families — the locale layout and the global 404 — so they load once
// here and share the CSS variables globals.css expects.
import { Playfair_Display, DM_Sans } from "next/font/google"

export const playfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["400", "600", "700"],
    style: ["normal", "italic"],
    variable: "--font-playfair",
    display: "swap",
})

export const dmSans = DM_Sans({
    subsets: ["latin"],
    weight: ["300", "400", "500", "600"],
    variable: "--font-dm-sans",
    display: "swap",
})
