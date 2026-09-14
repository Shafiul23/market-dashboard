import { PLACEHOLDER } from "../../lib/format"

export function ReceiptTime({ label }: { label: string }) {
  return (
    <p className="tabular-nums">
      Last book update:{" "}
      {label === PLACEHOLDER
        ? "Waiting for data."
        : label}
    </p>
  )
}
