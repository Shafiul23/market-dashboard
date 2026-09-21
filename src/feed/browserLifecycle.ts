type LifecycleHandlers = {
  offline: () => void
  online: () => void
  visible: () => void
}

export type FeedLifecycle = {
  isOnline: () => boolean
  subscribe: (handlers: LifecycleHandlers) => () => void
}

export const browserLifecycle: FeedLifecycle = {
  isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
  subscribe({ offline, online, visible }) {
    if (typeof window === "undefined") return () => {}
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") visible()
    }
    window.addEventListener("offline", offline)
    window.addEventListener("online", online)
    document.addEventListener("visibilitychange", visibilityChanged)
    return () => {
      window.removeEventListener("offline", offline)
      window.removeEventListener("online", online)
      document.removeEventListener("visibilitychange", visibilityChanged)
    }
  },
}
