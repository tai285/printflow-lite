import { Link, Route, Routes } from 'react-router'
import AuthPage from './pages/AuthPage.tsx'
import Layout from './components/Layout.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import { EmptyState, primaryButton } from './components/ui.tsx'
import HomePage from './pages/HomePage.tsx'
import NewQuotePage from './pages/NewQuotePage.tsx'
import OrderDetailPage from './pages/OrderDetailPage.tsx'
import OrdersPage from './pages/OrdersPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route element={<RequireAuth />}>
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrderDetailPage />} />
          <Route path="quotes/new" element={<NewQuotePage />} />
        </Route>
        <Route
          path="*"
          element={
            <EmptyState
              title="Page not found"
              actions={
                <Link to="/orders" className={primaryButton}>
                  Go to orders
                </Link>
              }
            />
          }
        />
      </Route>
    </Routes>
  )
}
