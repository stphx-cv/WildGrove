/**
 * Deferred realtime stubs — InsForge realtime is not wired yet.
 * Accept any Supabase-style `.on().subscribe()` arity so call sites compile
 * and no-op safely at runtime.
 */
export type DeferredRealtimeChannel = {
  name: string
  topic: string
  on: (
    event: string,
    filterOrCallback?: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback?: (...args: any[]) => void,
  ) => DeferredRealtimeChannel
  subscribe: (callback?: (...args: unknown[]) => void) => DeferredRealtimeChannel
  unsubscribe: () => Promise<"ok">
  send: (event?: unknown, payload?: unknown) => Promise<"ok">
}

/**
 * The stub says what it skipped, but only where a developer reads it. The same
 * line in the browser would land in the console of every visitor to the store,
 * who has no use for it and no way to act on it.
 */
export function warnDeferredOnServer(message: string): void {
  if (typeof window === "undefined") console.warn(message)
}

export function createDeferredRealtimeChannel(name: string): DeferredRealtimeChannel {
  const stub: DeferredRealtimeChannel = {
    name,
    topic: name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(..._args: any[]) {
      return stub
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subscribe(..._args: any[]) {
      warnDeferredOnServer(`[realtime:deferred] subscribe skipped for channel "${name}"`)
      return stub
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    unsubscribe(..._args: any[]) {
      return Promise.resolve("ok" as const)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    send(..._args: any[]) {
      warnDeferredOnServer(`[realtime:deferred] send skipped for channel "${name}"`)
      return Promise.resolve("ok" as const)
    },
  }
  return stub
}
