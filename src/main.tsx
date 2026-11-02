import React from 'react'
import '@fontsource-variable/bricolage-grotesque'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/Toast'
import { ConfermaProvider } from './components/ui'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <ConfermaProvider>
        <App />
        </ConfermaProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
)
