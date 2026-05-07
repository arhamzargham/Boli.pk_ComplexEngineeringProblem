import Link from 'next/link'

const PLATFORM_LINKS = ['Marketplace', 'How it works', 'Sell a device', 'Pricing & fees', 'KYC verification']
const LEGAL_LINKS    = ['Terms of service', 'Privacy policy', 'Penalty policy', 'Escrow agreement', 'Contact support']

export default function Footer() {
  return (
    <footer className="bg-obs">
      <div className="max-w-[1280px] mx-auto px-6 md:px-10 pt-10 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-8">

          {/* Brand */}
          <div>
            <span className="font-serif text-[20px] text-copper">Boli.pk</span>
            <p className="text-[11px] text-white/40 mt-2 max-w-[300px] leading-relaxed">
              Pakistan&apos;s first AI-verified escrow marketplace for high-value C2C device
              transactions. Every rupee protected. Every meetup safe.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap">
              {['AI Verified', 'Escrow Protected', '2PC Settlement'].map(badge => (
                <span
                  key={badge}
                  className="text-[9px] text-white/45 border border-white/10 bg-white/5 px-2.5 py-1 rounded"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3.5">Platform</p>
            <ul className="space-y-2.5">
              {PLATFORM_LINKS.map(link => (
                <li key={link}>
                  <Link href="/" className="text-[11px] text-white/55 hover:text-white transition-colors">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-3.5">Legal</p>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map(link => (
                <li key={link}>
                  <Link href="/" className="text-[11px] text-white/55 hover:text-white transition-colors">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.07] mt-8 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-1.5">
          <p className="text-[10px] text-white/30">
            © 2026 Boli.pk · Bahria University CEP · Islamabad, Pakistan
          </p>
          <p className="text-[10px] text-copper/40">
            Arham Jan · Abdul Qayyum
          </p>
        </div>
      </div>
    </footer>
  )
}
