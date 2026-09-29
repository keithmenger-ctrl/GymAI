'use client'

const DEMO = [
  { label: 'Owner', email: 'owner@vegaselite.test' },
  { label: 'Coach', email: 'keith@vegaselite.test' },
  { label: 'Parent', email: 'parent1@vegaselite.test' },
]

/** Fills the sign-in form with seeded demo credentials. Only rendered when NEXT_PUBLIC_DEMO_LOGINS=true. */
export function DemoLogins() {
  if (process.env.NEXT_PUBLIC_DEMO_LOGINS !== 'true') return null
  const fill = (email: string) => {
    const set = (name: string, value: string) => {
      const el = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
      if (!el) return
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('email', email)
    set('password', 'academyos-demo')
  }
  return (
    <div className="mt-10 border-t border-line pt-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Demo accounts</p>
      <div className="mt-3 flex gap-2">
        {DEMO.map((d) => (
          <button
            key={d.email}
            type="button"
            onClick={() => fill(d.email)}
            className="h-9 rounded-lg border border-line bg-card px-3 text-sm font-medium hover:bg-stone-100"
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
}
