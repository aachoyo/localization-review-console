import React from 'react'
import ReactDOM from 'react-dom/client'
// Self-hosted fonts (bundled — no network calls, per the tool's isolation principle).
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import App from './App'
import './index.css'
import { useReviewStore } from './store/useReviewStore'

// Dev-only: expose the store for smoke-testing without a file picker.
if (import.meta.env.DEV) {
  ;(window as unknown as { __review: unknown }).__review = { store: useReviewStore }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
