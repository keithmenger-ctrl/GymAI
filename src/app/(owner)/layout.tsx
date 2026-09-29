import { requireAdmin } from '@/lib/auth'
import { OwnerShell } from '@/components/shell/owner-shell'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()
  return <OwnerShell session={session}>{children}</OwnerShell>
}
