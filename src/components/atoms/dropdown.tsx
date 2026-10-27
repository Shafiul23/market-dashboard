import { useEffect, useId, useRef, useState } from "react"
import type { KeyboardEvent } from "react"

type DropdownProps = {
  id: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function Dropdown({ id, value, options, onChange }: DropdownProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const selectedIndex = options.findIndex((option) => option.value === value)

  useEffect(() => {
    if (!open) return

    function dismiss(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("pointerdown", dismiss)
    return () => document.removeEventListener("pointerdown", dismiss)
  }, [open])

  function expand(index = selectedIndex >= 0 ? selectedIndex : 0) {
    setActiveIndex(index)
    setOpen(true)
  }

  function select(index: number) {
    const option = options[index]
    if (option) onChange(option.value)
    setOpen(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault()
        const direction = event.key === "ArrowDown" ? 1 : -1
        if (!open) expand()
        else
          setActiveIndex(
            (index) => (index + direction + options.length) % options.length,
          )
        break
      }
      case "Home":
        event.preventDefault()
        expand(0)
        break
      case "End":
        event.preventDefault()
        expand(options.length - 1)
        break
      case "Enter":
      case " ":
        event.preventDefault()
        if (open) select(activeIndex)
        else expand()
        break
      case "Escape":
        if (open) event.preventDefault()
        setOpen(false)
        break
      case "Tab":
        setOpen(false)
        break
    }
  }

  return (
    <div
      ref={rootRef}
      className="relative text-sm"
      onBlur={() => setOpen(false)}
    >
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        onClick={() => (open ? setOpen(false) : expand())}
        onKeyDown={handleKeyDown}
        className="flex min-w-36 items-center justify-between gap-3 rounded border border-control bg-background px-3 py-1.5 text-primary hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        <span>{options[selectedIndex]?.label}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          fill="none"
          className={`size-3.5 text-muted ${open ? "rotate-180" : ""}`}
        >
          <path
            d="m4 6 4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={id}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute right-0 top-full z-20 mt-2 min-w-full rounded border border-divider bg-surface p-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.value === value}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => select(index)}
              className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded px-2 py-1.5 ${index === activeIndex ? "bg-surface-hover" : ""} ${option.value === value ? "text-accent-text" : "text-primary"}`}
            >
              {option.label}
              {option.value === value && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="size-3.5 shrink-0"
                >
                  <path
                    d="m3 8 3 3 7-7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
