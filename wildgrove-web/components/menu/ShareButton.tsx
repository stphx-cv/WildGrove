"use client"

import { useState, useRef, useEffect } from "react"
import { useTranslations } from "next-intl"
import { ClipboardIcon, EnvelopeIcon, ShareIcon } from "@wildgrove/ui/icons"
import { SocialIcon } from "@wildgrove/ui/social/SocialIcon"
import { TelegramIcon } from "@wildgrove/ui/social/TelegramIcon"

interface ShareButtonProps {
    title: string
    description: string
}

export function ShareButton({ title, description }: ShareButtonProps) {
    const t = useTranslations("menuProduct")
    const [open, setOpen] = useState(false)
    const [copied, setCopied] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Close dropdown on outside click
    useEffect(() => {
        if (!open) return
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClick)
        return () => document.removeEventListener("mousedown", handleClick)
    }, [open])

    const handleShare = async () => {
        const url = window.location.href

        // Use native Web Share API on supported devices
        if (navigator.share) {
            try {
                await navigator.share({ title, text: description, url })
            } catch {
                // User cancelled — ignore
            }
            return
        }

        // Desktop fallback: show dropdown
        setOpen((prev) => !prev)
    }

    const copyLink = async () => {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => {
            setCopied(false)
            setOpen(false)
        }, 1500)
    }

    // Instagram has no address that takes a link, so the link is copied and Instagram opens
    // for the person to paste it into a message or a story.
    const shareOnInstagram = () => {
        window.open("https://www.instagram.com/", "_blank", "noopener")
        void copyLink()
    }

    // Each network opens its own share page in a new tab; the address and text go in the query.
    const openShare = (target: string) => {
        window.open(target, "_blank", "noopener")
        setOpen(false)
    }

    const shareLinks = () => {
        const href = window.location.href
        const url = encodeURIComponent(href)
        const text = encodeURIComponent(`${title} | Wild Grove`)
        return {
            x: `https://x.com/intent/tweet?text=${text}&url=${url}`,
            whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} | Wild Grove ${href}`)}`,
            facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
            linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
            telegram: `https://t.me/share/url?url=${url}&text=${text}`,
            email: `mailto:?subject=${text}&body=${encodeURIComponent(`${description}\n\n${href}`)}`,
        }
    }

    const networks = [
        { key: "x", label: t("shareOnX"), icon: <SocialIcon platform="x" className="w-4 h-4 text-wg-muted" /> },
        { key: "whatsapp", label: t("shareOnWhatsApp"), icon: <SocialIcon platform="whatsapp" className="w-4 h-4 text-wg-muted" /> },
        { key: "facebook", label: t("shareOnFacebook"), icon: <SocialIcon platform="facebook" className="w-4 h-4 text-wg-muted" /> },
        { key: "linkedin", label: t("shareOnLinkedIn"), icon: <SocialIcon platform="linkedin" className="w-4 h-4 text-wg-muted" /> },
        { key: "telegram", label: t("shareOnTelegram"), icon: <TelegramIcon className="w-4 h-4 text-wg-muted" /> },
        { key: "email", label: t("shareByEmail"), icon: <EnvelopeIcon className="w-4 h-4 text-wg-muted" /> },
    ] as const
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleShare}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-brand border border-wg-accent/30 dark:border-wg-dark-accent/30 text-wg-accent dark:text-wg-dark-accent hover:bg-wg-accent/10 dark:hover:bg-wg-dark-accent/10 transition-colors"
                aria-label={t("share")}
            >
                <ShareIcon className="w-4 h-4" />
                {t("share")}
            </button>

            {/* Desktop dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-wg-surface dark:bg-wg-dark-raised rounded-card border border-wg-border/50 dark:border-wg-dark-border shadow-elevated z-50 py-1 animate-fade-in">
                    <button
                        onClick={copyLink}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left whitespace-nowrap text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-border/30 dark:hover:bg-wg-dark-border transition-colors"
                    >
                        <ClipboardIcon className="w-4 h-4 text-wg-muted" />
                        {copied ? t("linkCopied") : t("copyLink")}
                    </button>
                    {networks.map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() => openShare(shareLinks()[key])}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left whitespace-nowrap text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-border/30 dark:hover:bg-wg-dark-border transition-colors"
                        >
                            {icon}
                            {label}
                        </button>
                    ))}
                    <button
                        onClick={shareOnInstagram}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left whitespace-nowrap text-sm text-wg-text dark:text-wg-dark-text hover:bg-wg-border/30 dark:hover:bg-wg-dark-border transition-colors"
                    >
                        <SocialIcon platform="instagram" className="w-4 h-4 text-wg-muted" />
                        {t("shareOnInstagram")}
                    </button>
                </div>
            )}
        </div>
    )
}
