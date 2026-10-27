import { useId } from "react"
import { Dropdown } from "./dropdown"

const GROUPING_OPTIONS = [
  { value: "", label: "Off" },
  ...["10", "100", "1000"].map((value) => ({ value, label: `£${value} buckets` })),
]

type GroupingControlProps = {
  interval: string | null
  onChange: (interval: string | null) => void
}

export function GroupingControl({ interval, onChange }: GroupingControlProps) {
  const id = useId()
  return (
    <div className="flex items-center gap-3 text-sm">
      <label htmlFor={id}>Grouping</label>
      <Dropdown
        id={id}
        value={interval ?? ""}
        options={GROUPING_OPTIONS}
        onChange={(value) => onChange(value || null)}
      />
    </div>
  )
}
