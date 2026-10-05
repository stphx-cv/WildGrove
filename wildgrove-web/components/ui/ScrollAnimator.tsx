"use client"

import { useEffect } from "react"

export function ScrollAnimator() {
    useEffect(() => {
        const elements = document.querySelectorAll("[data-animate]")
        if (elements.length === 0) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("in-view")
                        observer.unobserve(entry.target) // animate only once
                    }
                })
            },
            {
                rootMargin: "0px 0px -60px 0px",
                threshold: 0.1,
            }
        )

        elements.forEach((el) => observer.observe(el))

        return () => observer.disconnect()
    }, [])

    return null // this component renders nothing — it just sets up the observer
}
