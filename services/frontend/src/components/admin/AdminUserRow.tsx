import StatusBadge from '@/components/ui/StatusBadge'
import KYCBadge from '@/components/ui/KYCBadge'
import { relativeTime } from '@/lib/formatters'
import type { AdminUserRow as AdminUserRowType } from '@/types'

interface Props {
  user: AdminUserRowType
}

export default function AdminUserRow({ user }: Props) {
  return (
    <tr>
      <td className="px-3 py-2.5 text-[12px] border-b border-border font-mono text-text-faint">
        {user.user_id.slice(-8).toUpperCase()}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border font-mono">
        {user.phone}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        <StatusBadge status={user.role} size="sm" />
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        <KYCBadge tier={user.kyc_tier} />
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border font-mono">
        {user.total_transactions}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border">
        {user.is_suspended ? (
          <span className="text-[10px] text-danger">Suspended</span>
        ) : (
          <span className="text-[10px] text-success">Active</span>
        )}
      </td>

      <td className="px-3 py-2.5 text-[12px] border-b border-border text-text-faint text-[10px]">
        {relativeTime(user.created_at)}
      </td>
    </tr>
  )
}
