import Link from 'next/link'
import { Cpu, Wallet, QrCode, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'

const STEPS = [
  {
    num: '01',
    icon: Cpu,
    title: 'AI Vetting in under 5 seconds',
    body: 'Every device listed on Boli.pk passes through our 6-point AI pipeline before going live. IMEI is validated against the Luhn algorithm, checked against PTA DIRBS for stolen or blacklisted status, and TAC code is matched to verify make and model accuracy.',
    bullets: [
      'Luhn IMEI validation — catches typos and fake IMEIs',
      'PTA DIRBS lookup — flags stolen or unregistered devices',
      'GSMA TAC match — confirms make / model accuracy',
      'Image consistency analysis — detects stock photos',
      'Condition assessment — AI scores 1–10 from photos',
      'Price sanity check — flags unrealistic pricing',
    ],
  },
  {
    num: '02',
    icon: Wallet,
    title: 'Escrow-protected bidding',
    body: 'When you bid, funds are reserved from your wallet immediately. If you are outbid, funds release instantly. You cannot be scammed — money never leaves escrow until you physically verify the device.',
    bullets: [
      'Funds reserved at bid time, not auction close',
      'Automatic release if outbid',
      'No meetup within 72h = full auto-refund',
      'Anti-sniping: last-minute bids extend the auction',
      'Daily exposure limit enforced by KYC tier',
      'Two-phase commit prevents partial settlement',
    ],
  },
  {
    num: '03',
    icon: QrCode,
    title: 'Cryptographic QR settlement at meetup',
    body: 'When you win, Boli.pk coordinates the meetup. The seller displays a QR code on their phone. You scan it. The device IMEI is verified live. Escrow releases only when both match.',
    bullets: [
      'Unique 64-char cryptographic QR per transaction',
      'IMEI scanned live — not taken on trust',
      'Both parties must be present for settlement',
      'QR expires 4 hours after confirmed meetup time',
      'Immutable receipt with GPS + timestamp',
      'Receipt verifiable with Boli.pk public key',
    ],
  },
  {
    num: '04',
    icon: ShieldCheck,
    title: 'Penalty policy protects everyone',
    body: 'Zero tolerance for no-shows. Sellers who ghost lose their penalty deposit. Buyers who win and disappear forfeit their buyer fee. Every auction that closes becomes a completed transaction.',
    bullets: [
      'Seller no-show: Rs. 2,000 penalty + listing suspended',
      'Buyer no-show: 2% buyer fee forfeited',
      'Repeated violations lead to permanent ban',
      'Admin mediation for genuine disputes',
      'Evidence preserved cryptographically',
      'Police report generation supported',
    ],
  },
]

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-obs">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 md:py-14">
          <p className="text-[10px] font-medium tracking-widest uppercase text-copper mb-3">
            The Boli.pk Process
          </p>
          <h1 className="font-serif text-[28px] md:text-[40px] text-white leading-tight max-w-[640px]">
            How we guarantee every transaction.
          </h1>
          <p className="text-[14px] text-white/55 mt-3 max-w-[520px] leading-relaxed">
            Boli.pk combines AI verification, escrow finance, and cryptographic settlement
            to make C2C device sales as safe as buying from a store.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-copper text-white px-5 py-2.5 rounded-[9px] text-[13px] font-medium mt-5 hover:bg-copper/90 transition-colors"
          >
            Browse Listings
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      {/* Steps */}
      <section className="bg-cream py-10">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 space-y-12">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const isOdd = idx % 2 === 0
            return (
              <div
                key={step.num}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start"
              >
                {/* Text — left on odd, right on even */}
                <div className={isOdd ? '' : 'md:order-2'}>
                  <p className="text-[10px] font-mono text-copper/60 mb-2">Step {step.num}</p>
                  <h2 className="font-serif text-[22px] text-text-primary leading-tight">
                    {step.title}
                  </h2>
                  <p className="text-[13px] text-text-muted mt-3 leading-relaxed">{step.body}</p>
                  <ul className="mt-4 space-y-2">
                    {step.bullets.map(bullet => (
                      <li key={bullet} className="flex items-start gap-2">
                        <CheckCircle2 size={13} className="text-success mt-0.5 flex-shrink-0" />
                        <span className="text-[12px] text-text-muted">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Visual card — right on odd, left on even */}
                <div className={isOdd ? '' : 'md:order-1'}>
                  <div className="bg-surface border border-border rounded-2xl p-8 min-h-[240px] flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-copper/10 flex items-center justify-center mb-4">
                      <Icon size={24} className="text-copper" strokeWidth={1.5} />
                    </div>
                    <p className="font-serif text-[18px] text-text-primary">{step.title}</p>
                    <p className="text-[11px] text-text-faint mt-2">
                      Step {step.num} of the Boli.pk guarantee
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA block */}
      <section className="bg-obs">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-12 text-center">
          <p className="font-serif text-[26px] text-white">Ready to buy or sell safely?</p>
          <p className="text-[13px] text-white/50 mt-2">Join 2,847 verified transactions</p>
          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <Link
              href="/"
              className="bg-copper text-white px-6 py-2.5 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
            >
              Browse Marketplace
            </Link>
            <Link
              href="/login"
              className="border border-white/20 text-white/70 px-6 py-2.5 rounded-[9px] text-[13px] hover:border-white/40 hover:text-white transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>
      </section>

      <StatsBar />
      <Footer />
    </div>
  )
}
