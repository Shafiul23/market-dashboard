import { vi } from "vitest"
import type { FeedSocket } from "./bookFeed"

export class FakeSocket implements FeedSocket {
  readyState = 0
  onopen: FeedSocket["onopen"] = null
  onmessage: FeedSocket["onmessage"] = null
  onerror: FeedSocket["onerror"] = null
  onclose: FeedSocket["onclose"] = null

  send = vi.fn<(data: string) => void>()
  close = vi.fn(() => {
    this.readyState = 2
  })

  open(): void {
    this.readyState = 1
    this.onopen?.(new Event("open"))
  }

  message(value: unknown): void {
    this.onmessage?.(
      new MessageEvent("message", { data: JSON.stringify(value) }),
    )
  }

  error(): void {
    this.onerror?.(new Event("error"))
  }

  serverClose(code = 1006, reason = ""): void {
    this.readyState = 3
    this.onclose?.({ code, reason } as CloseEvent)
  }
}
