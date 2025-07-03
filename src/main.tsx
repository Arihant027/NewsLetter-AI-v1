// src/main.tsx
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ThemeProvider } from './components/theme-provider.tsx'

createRoot(document.getElementById("root")!).render(
  <ThemeProvider 
    attribute="class"
    defaultTheme="system" 
    enableSystem
    storageKey="vite-ui-theme"
  >
    <App />
  </ThemeProvider>
);