// ══════════════════════════════════════════════════════════════════
// CMS sign in — email + password, or Google.
//
// No sign up and no locale switch: staff accounts are created from the
// storefront or by an owner, and this host only lets ADMIN | OWNER through
// (the role check lives in proxy.ts). Google does not create anything either:
// /api/auth/callback turns away any account that is not already staff.
// `insforge_*` cookies are host-only, so signing in here does not touch the
// storefront session and vice versa.
// ══════════════════════════════════════════════════════════════════
import { Suspense } from "react"
import { LoginForm } from "./LoginForm"

export const metadata = { title: "Sign in" }

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    )
}
