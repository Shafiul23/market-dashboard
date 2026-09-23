type LifecycleHandlers = {
  offline: () => void
  online: () => void
  visible: () => void
  hidden: () => void
}

export type FeedLifecycle = {
  isOnline: () => boolean
  isVisible: () => boolean
  subscribe: (handlers: LifecycleHandlers) => () => void
}

export const browserLifecycle: FeedLifecycle = {
  isOnline() {
    return typeof navigator === "undefined" || navigator.onLine !== false
  },

  isVisible() {
    return typeof document === "undefined" || document.visibilityState !== "hidden"
  },

  subscribe({ offline, online, visible, hidden }) {
    if (typeof window === "undefined") return () => {}
    const visibilityChanged = () => {
      if (document.visibilityState === "visible") visible()
      else if (document.visibilityState === "hidden") hidden()
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
