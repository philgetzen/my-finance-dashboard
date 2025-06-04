import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'tailwindcss/tailwind.css'; // (if not handled by Vite plugin)
import './index.css'
import RootApp from './App.jsx'
import './utils/localStorageCleanup' // Clean up any invalid localStorage values

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
)
