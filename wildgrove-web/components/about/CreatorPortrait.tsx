"use client"

import { useState } from "react"
import { FadeInImage } from "@wildgrove/ui/FadeInImage"

type CreatorPortraitProps = {
    name: string
    src: string
    initials: string
}

export function CreatorPortrait({ name, src, initials }: CreatorPortraitProps) {
    const [failed, setFailed] = useState(false)

    if (failed) {
        return (
            <div
                className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#3A5A40] to-[#C17F3A] font-display text-3xl sm:text-4xl font-semibold text-white"
                aria-hidden
            >
                {initials}
            </div>
        )
    }

    return (
        <FadeInImage
            src={src}
            alt={name}
            fill
            // The GitHub URL redirects to the current photo. The image optimizer
            // would keep the result for a month, so a new photo would not show.
            unoptimized
            className="object-cover object-center"
            sizes="128px"
            onError={() => setFailed(true)}
        />
    )
}
