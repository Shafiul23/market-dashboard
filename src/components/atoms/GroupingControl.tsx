import { useId } from "react"

const GROUPING_INTERVALS = ["10", "100", "1000"]

type GroupingControlProps = {
  interval: string | null
  onChange: (interval: string | null) => void
}

export function GroupingControl({ interval, onChange }: GroupingControlProps) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 text-sm">
      <label htmlFor={id}>Grouping</label>
      <select
        id={id}
        value={interval ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="rounded border border-slate-600 bg-slate-950 px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400"
      >
        <option value="">Off</option>
        {GROUPING_INTERVALS.map((value) => (
          <option key={value} value={value}>£{value} buckets</option>
        ))}
      </select>
    </div>
  )
}
