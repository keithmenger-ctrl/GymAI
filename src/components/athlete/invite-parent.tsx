'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui'
import { inviteParent } from '@/lib/actions/invite'

export function InviteParent({ guardianId, hasLogin }: { guardianId: string; hasLogin: boolean }) {
  const [pending, start] = useTransition()
  const [link, setLink] = useState<string>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)

  const run = () =>
    start(async () => {
      setError(undefined)
      setCopied(false)
      const r = await inviteParent(guardianId)
      if (r.error) setError(r.error)
      else setLink(r.link)
    })

  return (
    <div className="mt-3 space-y-2">
      <Button type="button" size="sm" variant="secondary" onClick={run} disabled={pending}>
        {pending ? 'Creating…' : hasLogin ? 'New sign-in link' : 'Invite to parent portal'}
      </Button>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      {link && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted">Share this one-time link with the parent. It lets them set a password.</p>
          <div className="flex gap-2">
            <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link"
              className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 text-xs" />
            <Button type="button" size="sm" variant="secondary"
              onClick={() => navigator.clipboard.writeText(link).then(() => setCopied(true))}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
