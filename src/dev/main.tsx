import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import FixturePreview from "./FixturePreview"
import "../index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FixturePreview />
  </StrictMode>,
)
