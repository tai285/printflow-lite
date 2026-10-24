import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { useCurrentUser, useLogin, useRegister } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { Notice, inputClass, primaryButton } from '../components/ui.tsx'
import { useDocumentTitle } from '../lib/useDocumentTitle.ts'

type Mode = 'login' | 'register'

/** Sign-in and sign-up share one form; `mode` decides the fields and wording. */
export default function AuthPage({ mode }: { mode: Mode }) {
  const registering = mode === 'register'
  useDocumentTitle(registering ? 'Create account' : 'Sign in')
  const user = useCurrentUser()
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const register = useRegister()
  const mutation = registering ? register : login

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Back to the page the visitor wanted, or the orders list.
  const from =
    (location.state as { from?: { pathname: string; search: string } } | null)
      ?.from ?? null
  const destination = from ? `${from.pathname}${from.search}` : '/orders'

  if (user) return <Navigate to={destination} replace />

  function submit(event: FormEvent) {
    event.preventDefault()
    const onSuccess = () => navigate(destination, { replace: true })
    if (registering) register.mutate({ name, email, password }, { onSuccess })
    else login.mutate({ email, password }, { onSuccess })
  }

  const error = mutation.error
  const fields = error instanceof ApiError ? error.fields : undefined
  const general = error && !fields ? error.message : undefined

  return (
    <div className="mx-auto max-w-sm space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">
        {registering ? 'Create an account' : 'Sign in'}
      </h1>
      {general && <Notice tone="error">{general}</Notice>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        {registering && (
          <Field
            label="Name"
            autoComplete="name"
            value={name}
            onChange={setName}
            error={fields?.name}
          />
        )}
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={fields?.email}
        />
        <Field
          label="Password"
          type="password"
          autoComplete={registering ? 'new-password' : 'current-password'}
          hint={registering ? 'At least 12 characters.' : undefined}
          value={password}
          onChange={setPassword}
          error={fields?.password}
        />
        <button
          type="submit"
          className={`${primaryButton} w-full`}
          disabled={mutation.isPending}
        >
          {mutation.isPending
            ? 'Please wait…'
            : registering
              ? 'Create account'
              : 'Sign in'}
        </button>
      </form>
      <p className="text-sm text-slate-600">
        {registering ? 'Already have an account?' : 'New here?'}{' '}
        <Link
          to={registering ? '/login' : '/register'}
          state={location.state}
          className="text-indigo-700 underline"
        >
          {registering ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  type = 'text',
  autoComplete,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  type?: string
  autoComplete?: string
}) {
  const id = `field-${label.toLowerCase()}`
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`]
    .filter(Boolean)
    .join(' ')
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        className={inputClass}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
