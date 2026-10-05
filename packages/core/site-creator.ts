// Single source for the portfolio creator — About page, Contact context, Sage `team` topic.
// Update linkedIn, instagram and whatsapp when those change.

export const SITE_CREATOR_LINKEDIN = "https://www.linkedin.com/in/stphx/"
export const SITE_CREATOR_INSTAGRAM = "https://www.instagram.com/stphx_cv/"

/** WhatsApp Business number: country code and digits only, as `wa.me` expects. */
export const SITE_CREATOR_WHATSAPP_NUMBER = "51967430874"

const WHATSAPP_GREETING = {
    en: "Hi Stephano, I saw Wild Grove and wanted to get in touch.",
    es: "Hola Stephano, vi Wild Grove y quería ponerme en contacto.",
} as const

/** A WhatsApp chat with the creator, with a first message in the page's language. */
export function getSiteCreatorWhatsAppUrl(locale: string): string {
    const text = locale === "es" ? WHATSAPP_GREETING.es : WHATSAPP_GREETING.en
    return `https://wa.me/${SITE_CREATOR_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
}

/** The source code, linked from the Terms page. Private until the project goes public. */
export const SITE_REPO_URL = "https://github.com/stphx-cv/WildGrove"

/**
 * Profile photo on About → Sobre mí.
 * `https://github.com/<user>.png` redirects to the current GitHub avatar, so a
 * photo change shows up for every clone without a new commit.
 */
export const SITE_CREATOR_PHOTO = "https://github.com/stphx-cv.png"

/** Shown in the portrait circle when that photo cannot be loaded. */
export const SITE_CREATOR_INITIALS = "St"

export const SITE_CREATOR = {
    linkedIn: SITE_CREATOR_LINKEDIN,
    instagram: SITE_CREATOR_INSTAGRAM,
    en: {
        name: "Stephano Camarena V.",
        role: "Project creator",
        school: "ISIL - Software development",
        bio: "I'm currently studying at ISIL and consider myself self-taught, always keeping up with what's new. I built Wild Grove to put myself to the test: I wanted to see how far I could get building a complete, working website. I wanted to use AI without ending up with something generic, so I took care over every detail. There are still things to improve and bugs to fix, and I'm correcting them little by little. I want the repository to be public and useful: a good website that other people can clone and change however they like, so that they recognize the work and someone takes an interest in the project. It's my portfolio project, the one I show when someone asks what I've developed.",
    },
    es: {
        name: "Stephano Camarena V.",
        role: "Creador del proyecto",
        school: "ISIL - Desarrollo de software",
        bio: "Actualmente estudio en ISIL y me considero autodidacta, siempre pendiente de lo nuevo. Hice Wild Grove para ponerme a prueba: quería ver hasta dónde podía llegar construyendo una web completa y funcional. Quería usar la IA sin que el resultado fuera algo genérico, y por eso cuidé cada detalle. Todavía hay cosas que mejorar y errores que resolver, y los voy corrigiendo poco a poco. Quiero que el repositorio sea público y útil: una buena web que otras personas puedan clonar y modificar como quieran, para que reconozcan el trabajo y alguien se interese por el proyecto. Es mi proyecto de portafolio, el que enseño cuando me preguntan qué he desarrollado.",
    },
} as const

export function getSiteCreatorProfile(locale: string) {
    return locale === "es" ? SITE_CREATOR.es : SITE_CREATOR.en
}

export function isSiteCreatorLinkedInReady(url: string = SITE_CREATOR_LINKEDIN): boolean {
    return url.startsWith("http") && !url.includes("YOUR-LINKEDIN")
}

/** Shape returned to Sage `get_restaurant_info` topic `team`. */
export function getSiteCreatorForSage() {
    return [
        {
            name: SITE_CREATOR.en.name,
            nameEs: SITE_CREATOR.es.name,
            role: SITE_CREATOR.en.role,
            roleEs: SITE_CREATOR.es.role,
            bio: SITE_CREATOR.en.bio,
            bioEs: SITE_CREATOR.es.bio,
            linkedIn: SITE_CREATOR_LINKEDIN,
            instagram: SITE_CREATOR_INSTAGRAM,
            whatsApp: getSiteCreatorWhatsAppUrl("en"),
        },
    ]
}
