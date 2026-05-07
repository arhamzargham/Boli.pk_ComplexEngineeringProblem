// All monetary values are integers (Paisa). NEVER use decimals.
// INVARIANT-09 from CLAUDE.md: all financial columns are BIGINT Paisa.

/** Convert Paisa integer to Rs. formatted string.
 *  22440000 → "Rs. 2,24,400"  ... but design uses Western format:
 *  22440000 → "Rs. 224,400"
 */
export function paisaToRs(paisa: number): string {
  const rupees = Math.floor(paisa / 100)
  return `Rs. ${rupees.toLocaleString('en-US')}`
}

/** Short currency without prefix: 22440000 → "2,24,400" */
export function paisaToRsShort(paisa: number): string {
  return Math.floor(paisa / 100).toLocaleString('en-US')
}

export function conditionLabel(rating: number): string {
  if (rating >= 9) return 'Excellent'
  if (rating >= 7) return 'Good'
  if (rating >= 5) return 'Fair'
  return 'Damaged'
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days > 0) return `${days}d ago`
  const hours = Math.floor(diff / 3_600_000)
  if (hours > 0) return `${hours}h ago`
  return 'Just now'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Karachi',
  }) + ' PKT'
}

/** Countdown from endTime ISO string. Returns "02h 14m 38s" or "Ended" */
export function auctionCountdown(endTime: string): string {
  const remaining = new Date(endTime).getTime() - Date.now()
  if (remaining <= 0) return 'Ended'
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1_000)
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
}

/** Format IMEI for display: 490154203237518 → "490154···518" */
export function truncateImei(imei: string): string {
  if (imei.length !== 15) return imei
  return `${imei.slice(0, 6)}···${imei.slice(-3)}`
}

/** Percentage of KYC daily limit (FULL = Rs.2,000,000 = 200,000,000 paisa) */
export function escrowExposurePct(exposurePaisa: number, kycTier: 'BASIC' | 'FULL'): number {
  const limit = kycTier === 'FULL' ? 200_000_000 : 20_000_000
  return Math.min(100, Math.round((exposurePaisa / limit) * 100))
}
