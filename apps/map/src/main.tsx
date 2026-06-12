import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { loadDataset } from './data'
import { AppStateProvider } from './state'
import App from './App'
import './styles.css'

const root = createRoot(document.getElementById('root')!)

root.render(
  <div className="splash">
    <div className="splash-mark">Scout</div>
    <div className="splash-sub">Loading alumni…</div>
  </div>
)

loadDataset()
  .then(ds => {
    root.render(
      <StrictMode>
        <AppStateProvider>
          <App ds={ds} />
        </AppStateProvider>
      </StrictMode>
    )
  })
  .catch(err => {
    console.error(err)
    root.render(
      <div className="splash">
        <div className="splash-mark">Scout</div>
        <div className="splash-sub">Couldn't load alumni data. Refresh to retry.</div>
      </div>
    )
  })
