import { getTranslations, setRequestLocale } from "next-intl/server"
import { HeroSection } from "@/components/sections/HeroSection"
import { FeaturedDishes } from "@/components/sections/FeaturedDishes"
import { PhilosophySection } from "@/components/sections/PhilosophySection"
import { TestimonialsSection } from "@/components/sections/TestimonialsSection"
import { CTASection } from "@/components/sections/CTASection"
import { ScrollAnimator } from "@/components/ui/ScrollAnimator"
import { buildAlternates } from "@wildgrove/core/seo/alternates"
import type { Locale } from "@/i18n/routing"

// The home reads only cache-backed data (featured dishes, ratings, discounts —
// all unstable_cache with revalidate: 300 + tags). Declaring revalidate here
// makes the route's ISR window explicit: it is statically generated, served
// from the CDN (low TTFB), and regenerated in the background every 5 min or on
// tag invalidation (menu / discounts / product-reviews).
export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "hero" })
  return {
    title: { absolute: "Wild Grove" },
    description: t("metaDescription"),
    alternates: buildAlternates("/", locale),
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <ScrollAnimator />
      <HeroSection />
      <FeaturedDishes locale={locale} />
      <PhilosophySection />
      <TestimonialsSection />
      <CTASection />
    </>
  )
}
