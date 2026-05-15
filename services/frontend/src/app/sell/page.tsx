import Link from 'next/link'
import { ShieldCheck, Clock, Smartphone, ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import StatsBar from '@/components/layout/StatsBar'

const TRUST_STATS = [
  { icon: ShieldCheck, value: 'Rs. 0',  label: 'Seller fraud losses to date' },
  { icon: Clock,       value: '< 5s',   label: 'Average AI vetting time' },
  { icon: Smartphone,  value: '2,847',  label: 'Devices sold safely' },
]

const LISTING_STEPS = [
  { num: '01', title: 'Enter device details',    desc: 'IMEI, make, model, condition rating, photos' },
  { num: '02', title: 'AI vetting — under 5s',   desc: '6-point pipeline runs automatically at submission' },
  { num: '03', title: 'Set reserve price',        desc: 'The minimum price you will accept at auction' },
  { num: '04', title: 'Listing goes live',         desc: 'Visible to all verified buyers on the marketplace' },
  { num: '05', title: 'Auction closes',            desc: 'Highest bid above reserve price wins' },
  { num: '06', title: 'Meetup + QR settle',        desc: 'Funds released from escrow at IMEI verification' },
]

const FEE_ROWS = [
  ['Platform fee',     '2% of winning bid'],
  ['WHT',              '1% of winning bid'],
  ['ICT tax',          '15% of platform fees'],
  ['Penalty deposit',  'Rs. 2,000 (refunded at meetup)'],
  ['NTN required',     'For bids above Rs. 50,000'],
]

export default function SellPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="bg-obs">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10 md:py-14">
          <p className="text-[10px] font-medium tracking-widest uppercase text-copper mb-3">
            Sell on Boli.pk
          </p>
          <h1 className="font-serif text-[28px] md:text-[40px] text-white leading-tight max-w-[640px]">
            List your device. Get paid safely.
          </h1>
          <p className="text-[14px] text-white/55 mt-3 max-w-[520px] leading-relaxed">
            AI-verified in under 5 seconds. Escrow-protected payment. No risk of non-payment.
            Boli.pk guarantees you receive your money before handing over the device.
          </p>
          <div className="flex items-center gap-3 mt-5 flex-wrap">
            <Link
              href="/sell/create"
              className="inline-flex items-center gap-2 bg-copper text-white px-5 py-2.5 rounded-[9px] text-[13px] font-medium hover:bg-copper/90 transition-colors"
            >
              Start Listing
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/how-it-works"
              className="border border-white/20 text-white/70 px-5 py-2.5 rounded-[9px] text-[13px] hover:border-white/40 hover:text-white transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Main content */}
      <main className="flex-1 bg-cream">
        <div className="max-w-[1280px] mx-auto px-6 md:px-10 py-10">

          {/* Trust stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
            {TRUST_STATS.map(stat => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-copper/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-copper" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[17px] font-medium font-mono">{stat.value}</p>
                    <p className="text-[10px] text-text-faint">{stat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Listing steps */}
          <h2 className="font-serif text-[22px] mb-6">How listing works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
            {LISTING_STEPS.map(step => (
              <div key={step.num} className="bg-surface border border-border rounded-xl p-4">
                <p className="text-[10px] font-mono text-copper/60 mb-2">{step.num}</p>
                <p className="text-[13px] font-medium text-text-primary">{step.title}</p>
                <p className="text-[11px] text-text-faint mt-1">{step.desc}</p>
              </div>
            ))}
          </div>

          {/* Fee table */}
          <div className="bg-surface border border-border rounded-xl p-5 max-w-[480px] mb-8">
            <h3 className="text-[13px] font-medium mb-3">Seller fee structure</h3>
            <div className="space-y-0">
              {FEE_ROWS.map(([label, val]) => (
                <div
                  key={label}
                  className="flex justify-between text-[12px] border-b border-border pb-2 mb-2 last:border-0 last:pb-0 last:mb-0"
                >
                  <span className="text-text-muted">{label}</span>
                  <span className="font-mono">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Phase 3 notice */}
          <div className="bg-copper-light border border-copper-border rounded-xl p-5 max-w-[480px]">
            <p className="text-[13px] font-medium text-obs">Seller listing form — coming in Phase 3</p>
            <p className="text-[11px] text-text-muted mt-1">
              The full listing submission flow — IMEI input, photo upload, and AI vetting status —
              will be live in the next sprint. Create an account to get verified first.
            </p>
            <Link
              href="/login"
              className="bg-copper text-white text-[12px] px-4 py-2 rounded-[9px] inline-block mt-3 hover:bg-copper/90 transition-colors"
            >
              Create account →
            </Link>
          </div>
        </div>
      </main>

      <StatsBar />
      <Footer />
    </div>
  )
}
