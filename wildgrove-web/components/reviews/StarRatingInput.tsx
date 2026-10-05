"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { StarSolidIcon } from "@wildgrove/ui/icons"

interface StarRatingInputProps {
    value: number
    onChange: (rating: number) => void
    disabled?: boolean
    /** The id of the visible label that names the group; without it, "Rating". */
    labelledBy?: string
}

export function StarRatingInput({ value, onChange, disabled, labelledBy }: StarRatingInputProps) {
    const t = useTranslations("starRating")
    const [hovered, setHovered] = useState(0)

    return (
        <div
            className="flex gap-1"
            role="radiogroup"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : t("label")}
        >
            {Array.from({ length: 5 }).map((_, i) => {
                const starValue = i + 1
                const filled = starValue <= (hovered || value)
                return (
                    <button
                        key={starValue}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(starValue)}
                        onMouseEnter={() => setHovered(starValue)}
                        onMouseLeave={() => setHovered(0)}
                        className={`transition-transform duration-150 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:scale-110"}`}
                        aria-label={t("star", { count: starValue })}
                        role="radio"
                        aria-checked={value === starValue}
                    >
                        <StarSolidIcon className={`w-7 h-7 ${filled ? "text-wg-accent dark:text-wg-dark-accent" : "text-wg-border dark:text-wg-dark-border"}`} />
                    </button>
                )
            })}
        </div>
    )
}
