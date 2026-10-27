import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './dashboard-cards.css'
import './styles.css'
import './readability.css'
import './mobile-performance.css'
import './mobile-layout.css'
import './features/streaks/streaks.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
