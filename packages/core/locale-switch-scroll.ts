/**
 * Shared key + freshness window for the "preserve scroll position when
 * switching language" feature. The writers are `<LanguageSelector>` and
 * `<HeaderMenu>`, both through `persistLocaleSwitchScroll()` below; the reader
 * is `<LocaleSwitchScrollRestorer>` mounted in `[locale]/layout.tsx`.
 *
 * Why a freshness window: only restore if the saved entry comes from a
 * just-clicked switch — otherwise we'd hijack normal navigations or page
 * reloads done long after the click.
 */
export const LOCALE_SWITCH_SCROLL_KEY = "wg:locale-switch-scroll"
export const LOCALE_SWITCH_SCROLL_MAX_AGE_MS = 5000

/**
 * Records where the page is scrolled, so the next locale's page can restore it.
 * Call it from the click handler, immediately before navigating.
 *
 * It lives here rather than inside the components for two reasons: the two
 * language switchers had identical copies of it, and `Date.now()` inside a
 * function declared in a component body trips `react-hooks/purity`, which
 * cannot see that the function only ever runs from an event handler.
 *
 * Silent on failure: sessionStorage is unavailable in private mode, and losing
 * a scroll position is not worth an error.
 */
export function persistLocaleSwitchScroll(): void {
    try {
        sessionStorage.setItem(
            LOCALE_SWITCH_SCROLL_KEY,
            JSON.stringify({ y: window.scrollY, t: Date.now() }),
        )
    } catch {
        // No storage, no restoration. Nothing else depends on this.
    }
}
