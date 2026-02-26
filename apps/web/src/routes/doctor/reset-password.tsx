import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { useSearch, useNavigate, Link } from '@tanstack/react-router'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
})

const resetSchema = z
  .object({
    password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })

type ForgotData = z.infer<typeof forgotSchema>
type ResetData = z.infer<typeof resetSchema>

export function DoctorResetPasswordPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { token?: string }
  const token = search.token

  const [status, setStatus] = useState<'idle' | 'success'>('idle')
  const [serverError, setServerError] = useState<string | null>(null)

  const forgotForm = useForm<ForgotData>({ resolver: zodResolver(forgotSchema) })
  const resetForm = useForm<ResetData>({ resolver: zodResolver(resetSchema) })

  async function onForgotSubmit(data: ForgotData) {
    setServerError(null)
    try {
      await api.post('/api/v1/doctor/auth/forgot-password', data)
      setStatus('success')
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Erro ao enviar email')
    }
  }

  async function onResetSubmit(data: ResetData) {
    setServerError(null)
    try {
      await api.post('/api/v1/doctor/auth/reset-password', {
        token,
        newPassword: data.password,
      })
      await navigate({ to: '/doctor/login' })
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : 'Erro ao redefinir senha')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-dark font-heading">Nocrato Health</h1>
          <p className="text-sm text-gray-500 mt-1">Portal do Médico</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{token ? 'Nova senha' : 'Recuperar senha'}</CardTitle>
            <CardDescription>
              {token
                ? 'Defina uma nova senha para sua conta'
                : 'Enviaremos um link de recuperação para seu email'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {token ? (
              <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-4">
                {serverError && (
                  <Alert variant="destructive">
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    error={!!resetForm.formState.errors.password}
                    {...resetForm.register('password')}
                  />
                  {resetForm.formState.errors.password && (
                    <p className="text-xs text-red-600">
                      {resetForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    error={!!resetForm.formState.errors.confirmPassword}
                    {...resetForm.register('confirmPassword')}
                  />
                  {resetForm.formState.errors.confirmPassword && (
                    <p className="text-xs text-red-600">
                      {resetForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={resetForm.formState.isSubmitting}
                >
                  Redefinir senha
                </Button>
              </form>
            ) : status === 'success' ? (
              <Alert variant="success">
                <AlertDescription>
                  Se o email estiver cadastrado, você receberá as instruções em breve.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-4">
                {serverError && (
                  <Alert variant="destructive">
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="doutor@exemplo.com"
                    error={!!forgotForm.formState.errors.email}
                    {...forgotForm.register('email')}
                  />
                  {forgotForm.formState.errors.email && (
                    <p className="text-xs text-red-600">
                      {forgotForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  loading={forgotForm.formState.isSubmitting}
                >
                  Enviar link de recuperação
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Link to="/doctor/login" className="text-xs text-blue-steel hover:underline">
                Voltar ao login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
