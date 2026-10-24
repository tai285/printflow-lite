import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { forgetSession } from './api/auth.ts'
import { ApiError, setUnauthorizedHandler } from './api/client.ts'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry only transient failures (network, 5xx), never 4xx answers.
      retry: (failureCount, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && failureCount < 2,
      refetchOnWindowFocus: true,
    },
  },
})

// A 401 on any data request means the session ended: forget the user so
// RequireAuth sends the visitor to the login page.
setUnauthorizedHandler(() => forgetSession(queryClient))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
