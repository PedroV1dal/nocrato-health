import { Outlet } from '@tanstack/react-router'
import { ToastContainer } from '@/components/toast-container'

export function RootLayout() {
  return (
    <>
      <Outlet />
      <ToastContainer />
    </>
  )
}
