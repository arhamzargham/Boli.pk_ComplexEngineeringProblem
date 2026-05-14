import { redirect } from 'next/navigation'

export default function FundWalletRedirect() {
  redirect('/admin/wallets')
}
