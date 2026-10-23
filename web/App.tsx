import { Link, Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import { EmptyState, primaryButton } from './components/ui.tsx'
import NewQuotePage from './pages/NewQuotePage.tsx'
import OrderDetailPage from './pages/OrderDetailPage.tsx'
import OrdersPage from './pages/OrdersPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="quotes/new" element={<NewQuotePage />} />
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
