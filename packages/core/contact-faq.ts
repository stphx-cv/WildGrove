// Static FAQ for the Contact page.

import { SITE_CREATOR_LINKEDIN } from "./site-creator"

export type ContactFaqItem = {
    questionEn: string
    questionEs: string
    answerEn: string
    answerEs: string
}

export const CONTACT_FAQ_ITEMS: ContactFaqItem[] = [
    {
        questionEn: "Is Wild Grove a real restaurant?",
        questionEs: "¿Wild Grove es un restaurante real?",
        answerEn:
            "No. It's a fictional restaurant and a portfolio project, so there are no real tables or deliveries. Reservations and orders work so that you can try them.",
        answerEs:
            "No. Es un restaurante ficticio y un proyecto de portafolio, así que no hay mesas ni entregas reales. Las reservas y los pedidos funcionan para que los pruebes.",
    },
    {
        questionEn: "Do I need an account to reserve?",
        questionEs: "¿Necesito una cuenta para reservar?",
        answerEn:
            "Yes. With an account, your request is tied to your profile and you can check its status under My Reservations.",
        answerEs:
            "Sí. Con una cuenta, tu solicitud queda vinculada a tu perfil y puedes ver su estado en Mis reservas.",
    },
    {
        questionEn: "Where can I ask something?",
        questionEs: "¿Dónde puedo preguntar algo?",
        answerEn:
            "Open the chat and ask Sage about the menu, the opening hours or availability. For something about your account, send an inquiry from this page.",
        answerEs:
            "Abre el chat y pregúntale a Sage por la carta, los horarios o la disponibilidad. Para algo de tu cuenta, envía una consulta desde esta página.",
    },
    {
        questionEn: "Who built this website?",
        questionEs: "¿Quién construyó este sitio?",
        answerEn:
            `Made by Stephano, a student at ISIL. See the [About page](/about) for more, or connect on [LinkedIn](${SITE_CREATOR_LINKEDIN}).`,
        answerEs:
            `Hecho por Stephano, estudiante de ISIL. Mira la [página Nosotros](/about) para saber más, o conéctate por [LinkedIn](${SITE_CREATOR_LINKEDIN}).`,
    },
]

export function getContactFaqForLocale(locale: string): { q: string; a: string }[] {
    const isEs = locale === "es"
    return CONTACT_FAQ_ITEMS.map((item) => ({
        q: isEs ? item.questionEs : item.questionEn,
        a: isEs ? item.answerEs : item.answerEn,
    }))
}
