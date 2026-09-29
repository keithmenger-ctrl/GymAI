import { cn } from '@/lib/cn'
import type { ComponentProps, ReactNode } from 'react'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'lg' | 'sm'
}

export function buttonClass(variant: ButtonProps['variant'] = 'primary', size: ButtonProps['size'] = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none',
    size === 'sm' && 'h-8 px-3 text-sm',
    size === 'md' && 'h-10 px-4 text-sm',
    size === 'lg' && 'h-14 px-6 text-base',
    variant === 'primary' && 'bg-ink text-white hover:bg-black/85',
    variant === 'secondary' && 'bg-card text-ink border border-line hover:bg-stone-100',
    variant === 'ghost' && 'text-ink hover:bg-stone-100',
    variant === 'danger' && 'bg-card text-bad border border-line hover:bg-red-50',
  )
}

export function Button({ variant, size, className, ...p }: ButtonProps) {
  return <button className={cn(buttonClass(variant, size), className)} {...p} />
}

export const fieldClass =
  'w-full rounded-lg border border-line bg-card px-3 h-10 text-sm placeholder:text-muted/70 focus:border-ink focus:outline-none'

export function Input({ className, ...p }: ComponentProps<'input'>) {
  return <input className={cn(fieldClass, className)} {...p} />
}
export function Select({ className, ...p }: ComponentProps<'select'>) {
  return <select className={cn(fieldClass, 'pr-8', className)} {...p} />
}
export function Textarea({ className, ...p }: ComponentProps<'textarea'>) {
  return <textarea className={cn(fieldClass, 'h-auto py-2 min-h-24', className)} {...p} />
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  )
}

export function Card({ className, ...p }: ComponentProps<'div'>) {
  return <div className={cn('rounded-xl border border-line bg-card', className)} {...p} />
}

const tones = {
  neutral: 'bg-stone-100 text-stone-700',
  ok: 'bg-green-100 text-green-800',
  warn: 'bg-amber-100 text-amber-800',
  bad: 'bg-red-100 text-red-800',
  volt: 'bg-volt text-ink',
  ink: 'bg-ink text-white',
}
export function Badge({ tone = 'neutral', className, ...p }: ComponentProps<'span'> & { tone?: keyof typeof tones }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)} {...p} />
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card className="border-dashed px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </Card>
  )
}

/** Honest placeholder for screens that are planned but not built yet. */
export function NotImplemented({ title, phase, note }: { title: string; phase: number; note?: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        title="Not implemented yet"
        body={note ?? `This screen is planned for build phase ${phase}. Nothing here is functional yet.`}
      />
    </>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </Card>
  )
}
