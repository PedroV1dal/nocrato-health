// Minimal toast utility — sem dependência de sonner (não instalado no MVP)
// Dispara um evento customizado que o ToastProvider (em __root.tsx) escuta.

export type ToastType = 'success' | 'error' | 'info'

export interface ToastEvent {
  message: string
  type: ToastType
}

function dispatch(message: string, type: ToastType) {
  const event = new CustomEvent<ToastEvent>('nocrato:toast', { detail: { message, type } })
  window.dispatchEvent(event)
}

export const toast = {
  success: (message: string) => dispatch(message, 'success'),
  error: (message: string) => dispatch(message, 'error'),
  info: (message: string) => dispatch(message, 'info'),
}
