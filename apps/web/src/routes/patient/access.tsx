import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { KeyRound, AlertCircle } from 'lucide-react'

import {
  usePatientPortalAccess,
  savePatientSession,
} from '@/lib/queries/patient-portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ─── Schema ───────────────────────────────────────────────────────────────────

const accessSchema = z.object({
  code: z.string().min(1, 'O código de acesso é obrigatório.'),
})

type AccessForm = z.infer<typeof accessSchema>

// ─── Componente ───────────────────────────────────────────────────────────────

export function PatientAccessPage() {
  const navigate = useNavigate()
  const accessMutation = usePatientPortalAccess()
  const [apiError, setApiError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessForm>({
    resolver: zodResolver(accessSchema),
  })

  async function onSubmit(formData: AccessForm) {
    setApiError(null)

    try {
      const data = await accessMutation.mutateAsync(formData.code.trim())
      savePatientSession({ code: formData.code.trim(), data })
      void navigate({ to: '/patient/portal' })
    } catch (err: unknown) {
      const error = err as Error & { data?: { message?: string } }
      setApiError(
        error.data?.message ?? error.message ?? 'Código inválido ou inativo.',
      )
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">

        {/* Logo / identidade */}
        <div className="text-center mb-8 space-y-2">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-amber-bright/20 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-amber-dark" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-amber-dark font-heading">
            Portal do Paciente
          </h1>
          <p className="text-sm text-amber-mid leading-relaxed">
            Digite o código que você recebeu por WhatsApp
          </p>
        </div>

        {/* Cartão do formulário */}
        <div className="bg-white rounded-2xl border border-[#e8dfc8] shadow-sm p-6 space-y-5">

          {/* Erro da API */}
          {apiError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{apiError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="access-code" className="text-amber-dark font-medium">
                Código de acesso
              </Label>
              <Input
                id="access-code"
                placeholder="Ex: ABC-1234-XYZ"
                autoComplete="off"
                autoFocus
                error={!!errors.code}
                {...register('code')}
              />
              {errors.code && (
                <p className="text-xs text-red-500">{errors.code.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={isSubmitting || accessMutation.isPending}
            >
              Acessar Portal
            </Button>
          </form>
        </div>

        {/* Rodapé informativo */}
        <p className="text-center text-xs text-amber-mid mt-6 leading-relaxed">
          O código foi enviado pelo WhatsApp após a sua consulta.
          <br />
          Em caso de dúvidas, entre em contato com a clínica.
        </p>
      </div>
    </div>
  )
}
