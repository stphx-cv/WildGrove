"use client"

// Defers the chat bundle (ChatProvider is ~1.3k lines) out of the initial
// page load. As a client component it can use `next/dynamic` with
// `ssr: false`, which a Server Component layout cannot. The chunks load on
// the client after hydration, so the chat no longer blocks first paint.
import dynamic from "next/dynamic"
import type { ChatMode } from "@wildgrove/core/chat/chat-settings"

const ChatProvider = dynamic(
    () => import("./ChatProvider").then((m) => m.ChatProvider),
    { ssr: false },
)
const ChatWidget = dynamic(
    () => import("./ChatWidget").then((m) => m.ChatWidget),
    { ssr: false },
)

export function ChatLazy({ locale, chatMode }: { locale: string; chatMode: ChatMode }) {
    return (
        <ChatProvider locale={locale} chatMode={chatMode}>
            <ChatWidget />
        </ChatProvider>
    )
}
