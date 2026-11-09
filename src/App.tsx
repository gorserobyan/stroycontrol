import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import { RequireAuth } from '@/auth/RequireAuth'
import { FullPageLoader } from '@/components/FullPageLoader'
import { LoginPage } from '@/pages/LoginPage'

// Screens behind authentication are loaded on demand to keep the login page light.
const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    HydrateFallback: FullPageLoader,
    children: [
      {
        lazy: async () => ({ Component: (await import('@/components/layout/AppLayout')).AppLayout }),
        children: [
          { index: true, element: <Navigate to="/sites" replace /> },
          { path: 'sites', lazy: async () => ({ Component: (await import('@/features/sites/SitesPage')).SitesPage }) },
          {
            path: 'sites/:siteId',
            lazy: async () => ({ Component: (await import('@/features/sites/SiteDetailsPage')).SiteDetailsPage }),
          },
          { path: 'tasks', lazy: async () => ({ Component: (await import('@/features/tasks/TasksPage')).TasksPage }) },
          {
            path: 'tasks/:taskId',
            lazy: async () => ({ Component: (await import('@/features/tasks/TaskDetailsPage')).TaskDetailsPage }),
          },
          { path: '*', lazy: async () => ({ Component: (await import('@/pages/NotFoundPage')).NotFoundPage }) },
        ],
      },
    ],
  },
])

export function App() {
  return <RouterProvider router={router} />
}
