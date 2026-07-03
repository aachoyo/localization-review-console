import React from 'react'
import ReactDOM from 'react-dom/client'
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
