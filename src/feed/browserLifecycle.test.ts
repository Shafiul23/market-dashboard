import { afterEach, describe, expect, it, vi } from "vitest"
import { browserLifecycle } from "./browserLifecycle"

afterEach(() => vi.unstubAllGlobals())

describe("browserLifecycle", () => {
  it("reads browser connectivity and removes every registered listener", () => {
    const windowTarget = new EventTarget()
    const documentTarget = Object.assign(new EventTarget(), { visibilityState: "hidden" })
    const navigatorState = { onLine: false }
    vi.stubGlobal("window", windowTarget)
    vi.stubGlobal("document", documentTarget)
    vi.stubGlobal("navigator", navigatorState)
    const addWindow = vi.spyOn(windowTarget, "addEventListener")
    const removeWindow = vi.spyOn(windowTarget, "removeEventListener")
    const addDocument = vi.spyOn(documentTarget, "addEventListener")
    const removeDocument = vi.spyOn(documentTarget, "removeEventListener")
    const handlers = { offline: vi.fn(), online: vi.fn(), visible: vi.fn(), hidden: vi.fn() }
    const unsubscribe = browserLifecycle.subscribe(handlers)

    expect(browserLifecycle.isOnline()).toBe(false)
    expect(browserLifecycle.isVisible()).toBe(false)
    navigatorState.onLine = true
    expect(browserLifecycle.isOnline()).toBe(true)
    windowTarget.dispatchEvent(new Event("offline"))
    windowTarget.dispatchEvent(new Event("online"))
    documentTarget.dispatchEvent(new Event("visibilitychange"))
    expect(handlers.visible).not.toHaveBeenCalled()
    documentTarget.visibilityState = "visible"
    expect(browserLifecycle.isVisible()).toBe(true)
    documentTarget.dispatchEvent(new Event("visibilitychange"))
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    expect(addWindow.mock.calls.map(([type]) => type)).toEqual(["offline", "online"])
    expect(addDocument.mock.calls.map(([type]) => type)).toEqual(["visibilitychange"])
    expect(removeWindow.mock.calls).toEqual(addWindow.mock.calls)
    expect(removeDocument.mock.calls).toEqual(addDocument.mock.calls)
    windowTarget.dispatchEvent(new Event("offline"))
    windowTarget.dispatchEvent(new Event("online"))
    documentTarget.dispatchEvent(new Event("visibilitychange"))
    for (const handler of Object.values(handlers)) expect(handler).toHaveBeenCalledTimes(1)
    documentTarget.visibilityState = "hidden"
    documentTarget.dispatchEvent(new Event("visibilitychange"))
    expect(handlers.hidden).toHaveBeenCalledTimes(1)
  })
})
