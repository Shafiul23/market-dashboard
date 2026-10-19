import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import FixturePreview from "./FixturePreview"
import LoadPreview from "./LoadPreview"
import "../index.css"

// Avoid Strict Mode's repeated development effects in the benchmark.
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(location.search).has("load")
    ? <LoadPreview />
    : <StrictMode><FixturePreview /></StrictMode>,
)
