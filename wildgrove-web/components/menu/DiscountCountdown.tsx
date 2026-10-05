"use client"

import { useEffect, useState } from "react"

interface TimeLeft {
    days: number
    hours: number
    minutes: number
    seconds: number
    total: number
}

function compute(validUntil: string): TimeLeft {
    const diff = new Date(validUntil).getTime() - Date.now()
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
    const total = diff
    const days = Math.floor(diff / 86_400_000)
    const hours = Math.floor((diff % 86_400_000) / 3_600_000)
    const minutes = Math.floor((diff % 3_600_000) / 60_000)
    const seconds = Math.floor((diff % 60_000) / 1_000)
    return { days, hours, minutes, seconds, total }
}

function pad(n: number) {
    return String(n).padStart(2, "0")
}

interface Props {
    validUntil: string
    locale?: string
}

const labels = {
    en: { days: "days", hours: "hrs", minutes: "min", seconds: "sec", offer: "Offer ends in", expired: "Offer has ended" },
    es: { days: "días", hours: "hrs", minutes: "min", seconds: "seg", offer: "Oferta termina en", expired: "La oferta ha terminado" },
}

export function DiscountCountdown({ validUntil, locale = "en" }: Props) {
    const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => compute(validUntil))
    const l = labels[locale as keyof typeof labels] ?? labels.en

    useEffect(() => {
        if (timeLeft.total <= 0) return
        const id = setInterval(() => {
            setTimeLeft(compute(validUntil))
        }, 1_000)
        return () => clearInterval(id)
    }, [validUntil, timeLeft.total])

    if (timeLeft.total <= 0) {
        return (
            <p className="text-xs text-center text-wg-muted dark:text-wg-dark-muted py-1">
                {l.expired}
            </p>
        )
    }

    const isUrgent = timeLeft.total < 3_600_000 // < 1 hour

    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-center text-wg-muted dark:text-wg-dark-muted">
                {l.offer}
            </p>
            <div className="flex items-stretch justify-center gap-1.5">
                {timeLeft.days > 0 && (
                    <Unit value={pad(timeLeft.days)} label={l.days} urgent={isUrgent} />
                )}
                <Unit value={pad(timeLeft.hours)} label={l.hours} urgent={isUrgent} />
                <Colon urgent={isUrgent} />
                <Unit value={pad(timeLeft.minutes)} label={l.minutes} urgent={isUrgent} />
                <Colon urgent={isUrgent} />
                <Unit value={pad(timeLeft.seconds)} label={l.seconds} urgent={isUrgent} />
            </div>
        </div>
    )
}

function Unit({ value, label, urgent }: { value: string; label: string; urgent: boolean }) {
    return (
        <div className="flex flex-col items-center min-w-[3rem]">
            <div
                className={[
                    "w-full text-center font-display font-bold text-xl sm:text-2xl px-2 py-1.5 rounded-brand tabular-nums transition-colors",
                    urgent
                        ? "bg-red-500/10 dark:bg-red-500/15 text-red-500 dark:text-red-400"
                        : "bg-wg-accent/10 dark:bg-wg-dark-accent/15 text-wg-accent dark:text-wg-dark-accent",
                ].join(" ")}
            >
                {value}
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-wg-muted dark:text-wg-dark-muted mt-0.5">
                {label}
            </span>
        </div>
    )
}

function Colon({ urgent }: { urgent: boolean }) {
    return (
        <span
            className={[
                "font-display font-bold text-xl sm:text-2xl self-start pt-1.5 select-none",
                urgent
                    ? "text-red-500/60 dark:text-red-400/60"
                    : "text-wg-accent/50 dark:text-wg-dark-accent/50",
            ].join(" ")}
        >
            :
        </span>
    )
}
