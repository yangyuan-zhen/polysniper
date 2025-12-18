import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SignalProvider } from './contexts/SignalContext'
import { MatchProvider } from './contexts/MatchContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SignalProvider>
      <MatchProvider>
        <App />
      </MatchProvider>
    </SignalProvider>
  </StrictMode>,
)
