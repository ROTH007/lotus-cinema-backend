import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Body from './assets/controls/Body.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Body />
  </StrictMode>,
)