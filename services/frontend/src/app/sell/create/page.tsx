'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  Check, ChevronRight, Camera, Upload, X, AlertCircle,
  ShieldCheck, ArrowRight, Info,
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import { paisaToRs } from '@/lib/formatters'
import { api } from '@/lib/api'

// ── Luhn check ───────────────────────────────────────────────────────────────
function luhnCheck(imei: string): boolean {
  if (!/^\d{15}$/.test(imei)) return false
  const digits = imei.split('').map(Number).reverse()
  const total = digits.reduce((sum, d, i) => {
    if (i % 2 === 1) {
      const doubled = d * 2
      return sum + (doubled > 9 ? doubled - 9 : doubled)
    }
    return sum + d
  }, 0)
  return total % 10 === 0
}

// ── Form state ────────────────────────────────────────────────────────────────
interface ListingFormState {
  brand: string
  model: string
  storage: string
  color: string
  year: string
  condition: 'Mint' | 'Good' | 'Fair' | 'Poor' | ''
  accessories: string[]
  warranty: string
  sim_slots: string
  battery_health: number | ''
  imei: string
  photos: File[]
  reserve_price_pkr: number | ''
  auction_duration_hours: number
  penalty_acknowledged: boolean
}

const EMPTY_FORM: ListingFormState = {
  brand: '', model: '', storage: '', color: '', year: '',
  condition: '', accessories: [], warranty: '', sim_slots: '', battery_health: '',
  imei: '', photos: [],
  reserve_price_pkr: '', auction_duration_hours: 24, penalty_acknowledged: false,
}

// ── Step indicator ────────────────────────────────────────────────────────────
const STEPS = ['Device Info', 'Condition & Specs', 'Photos & IMEI', 'Pricing & Launch']

function StepIndicator({ current, onClick }: { current: number; onClick: (s: number) => void }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, idx) => {
        const num = idx + 1
        const done = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => done && onClick(num)}
              className={`flex flex-col items-center gap-1 ${done ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className={[
                'w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-medium transition-colors',
                done   ? 'bg-success text-white' :
                active ? 'bg-copper text-white'  :
                         'bg-border text-text-faint',
              ].join(' ')}>
                {done ? <Check size={13} /> : num}
              </div>
              <span className={`text-[9px] hidden sm:block leading-tight text-center ${
                active ? 'text-copper font-medium' :
                done   ? 'text-text-muted' :
                         'text-text-faint'
              }`}>{label}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 ${done ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1 ────────────────────────────────────────────────────────────────────
const BRANDS = ['Apple', 'Samsung', 'OnePlus', 'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'Huawei', 'Other']
const STORAGES = ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB']
const YEARS = Array.from({ length: 8 }, (_, i) => String(2025 - i))

function Step1({ form, setForm }: { form: ListingFormState; setForm: (f: ListingFormState) => void }) {
  const f = (field: keyof ListingFormState, val: string) =>
    setForm({ ...form, [field]: val })

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface'
  const selectCls = inputCls

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Brand *</label>
          <select value={form.brand} onChange={e => f('brand', e.target.value)} className={selectCls}>
            <option value="">Select brand</option>
            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Model *</label>
          <input
            type="text" placeholder="e.g. iPhone 13 Pro Max"
            value={form.model} onChange={e => f('model', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Storage *</label>
          <select value={form.storage} onChange={e => f('storage', e.target.value)} className={selectCls}>
            <option value="">Select storage</option>
            {STORAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Color *</label>
          <input
            type="text" placeholder="e.g. Midnight Black"
            value={form.color} onChange={e => f('color', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Year of purchase *</label>
          <select value={form.year} onChange={e => f('year', e.target.value)} className={selectCls}>
            <option value="">Select year</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
const CONDITIONS: { value: 'Mint' | 'Good' | 'Fair' | 'Poor'; desc: string }[] = [
  { value: 'Mint', desc: 'Pristine, like new, no marks' },
  { value: 'Good', desc: 'Minor scratches, fully functional' },
  { value: 'Fair', desc: 'Visible wear, fully functional' },
  { value: 'Poor', desc: 'Cracked screen or heavy damage' },
]
const ACCESSORIES_OPTIONS = ['Original Box', 'Charger', 'Earphones', 'Case', 'None']
const WARRANTY_OPTIONS = ['No warranty', 'Out of warranty', 'Under warranty (enter months)']
const SIM_OPTIONS = ['Single SIM', 'Dual SIM']

const CONDITION_COLORS: Record<string, string> = {
  Mint: 'border-success bg-success/5',
  Good: 'border-copper bg-copper/5',
  Fair: 'border-warning bg-warning/5',
  Poor: 'border-danger bg-danger/5',
}

function Step2({ form, setForm }: { form: ListingFormState; setForm: (f: ListingFormState) => void }) {
  const toggleAcc = (acc: string) => {
    const cur = form.accessories
    setForm({
      ...form,
      accessories: cur.includes(acc) ? cur.filter(a => a !== acc) : [...cur, acc],
    })
  }

  const selectCls = 'w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface'

  return (
    <div className="space-y-5">
      {/* Condition */}
      <div>
        <label className="text-[11px] font-medium text-text-muted block mb-2">Condition *</label>
        <div className="grid grid-cols-2 gap-2.5">
          {CONDITIONS.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setForm({ ...form, condition: c.value })}
              className={[
                'border-2 rounded-xl p-3 text-left transition-colors',
                form.condition === c.value
                  ? CONDITION_COLORS[c.value]
                  : 'border-border hover:border-text-faint',
              ].join(' ')}
            >
              <p className="text-[13px] font-medium">{c.value}</p>
              <p className="text-[10px] text-text-faint mt-0.5">{c.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Accessories */}
      <div>
        <label className="text-[11px] font-medium text-text-muted block mb-2">Accessories included</label>
        <div className="flex flex-wrap gap-2">
          {ACCESSORIES_OPTIONS.map(a => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAcc(a)}
              className={[
                'text-[11px] px-3 py-1.5 rounded-full border transition-colors',
                form.accessories.includes(a)
                  ? 'bg-copper text-white border-copper'
                  : 'border-border text-text-muted hover:border-copper/40',
              ].join(' ')}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Warranty</label>
          <select
            value={form.warranty}
            onChange={e => setForm({ ...form, warranty: e.target.value })}
            className={selectCls}
          >
            <option value="">Select</option>
            {WARRANTY_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">SIM slots</label>
          <select
            value={form.sim_slots}
            onChange={e => setForm({ ...form, sim_slots: e.target.value })}
            className={selectCls}
          >
            <option value="">Select</option>
            {SIM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-1.5">Battery health %</label>
          <input
            type="number" min={1} max={100} placeholder="e.g. 89"
            value={form.battery_health}
            onChange={e => {
              const v = parseInt(e.target.value, 10)
              setForm({ ...form, battery_health: isNaN(v) ? '' : Math.min(100, Math.max(1, v)) })
            }}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-copper bg-surface"
          />
        </div>
      </div>
    </div>
  )
}

// ── Step 3 ────────────────────────────────────────────────────────────────────
const PHOTO_LABELS = ['Front', 'Back', 'Screen', 'Box', 'Accessory', 'Other']

function Step3({
  form, setForm, router,
}: {
  form: ListingFormState
  setForm: (f: ListingFormState) => void
  router: ReturnType<typeof useRouter>
}) {
  const imeiValid = luhnCheck(form.imei)
  const imeiDirty = form.imei.length > 0

  const removePhoto = (idx: number) => {
    const photos = form.photos.filter((_, i) => i !== idx)
    setForm({ ...form, photos })
  }

  const addPhotos = (files: FileList | null) => {
    if (!files) return
    const next = [...form.photos, ...Array.from(files)].slice(0, 6)
    setForm({ ...form, photos: next })
  }

  return (
    <div className="space-y-5">
      {/* IMEI */}
      <div>
        <label className="text-[11px] font-medium text-text-muted block mb-1.5">
          IMEI Number *
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              inputMode="numeric"
              maxLength={15}
              placeholder="15-digit IMEI"
              value={form.imei}
              onChange={e => setForm({ ...form, imei: e.target.value.replace(/\D/g, '').slice(0, 15) })}
              className={[
                'w-full border rounded-lg px-3 py-2.5 text-[13px] font-mono focus:outline-none bg-surface transition-colors pr-8',
                imeiDirty
                  ? imeiValid ? 'border-success focus:border-success' : 'border-danger focus:border-danger'
                  : 'border-border focus:border-copper',
              ].join(' ')}
            />
            {imeiDirty && (
              <span className={`absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium ${imeiValid ? 'text-success' : 'text-danger'}`}>
                {imeiValid ? '✓' : '✗'}
              </span>
            )}
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => router.push(`/sell/imei?return=/sell/create`)}
          >
            <Camera size={14} />
            Scan
          </Button>
        </div>
        <p className="text-[10px] text-text-faint mt-1.5 flex items-center gap-1">
          <Info size={10} />
          Dial *#06# on your phone to find your IMEI
        </p>
        {imeiDirty && !imeiValid && (
          <p className="text-[11px] text-danger mt-1 flex items-center gap-1">
            <AlertCircle size={11} />
            Invalid IMEI — please check the number (Luhn check failed)
          </p>
        )}
      </div>

      {/* Photos */}
      <div>
        <label className="text-[11px] font-medium text-text-muted block mb-2">
          Photos * <span className="text-text-faint font-normal">({form.photos.length}/6)</span>
        </label>

        {form.photos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
            {form.photos.map((file, idx) => (
              <div
                key={idx}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 ${
                  idx === 0 ? 'border-copper' : 'border-border'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={URL.createObjectURL(file)}
                  alt={PHOTO_LABELS[idx] ?? 'Photo'}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(idx)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-obs/80 text-white flex items-center justify-center"
                >
                  <X size={10} />
                </button>
                <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-obs/60 text-white py-0.5">
                  {idx === 0 ? '★ ' : ''}{PHOTO_LABELS[idx] ?? 'Photo'}
                </span>
              </div>
            ))}
          </div>
        )}

        {form.photos.length < 6 && (
          <label className="block border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-copper/40 transition-colors">
            <Upload size={22} className="text-text-faint mx-auto mb-2" />
            <p className="text-[12px] text-text-faint">Click to add photos (JPEG, PNG, WebP)</p>
            <p className="text-[10px] text-text-faint mt-0.5">First photo will be the primary listing image</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={e => addPhotos(e.target.files)}
            />
          </label>
        )}
      </div>
    </div>
  )
}

// ── Step 4 ────────────────────────────────────────────────────────────────────
const DURATIONS: { hours: number; label: string }[] = [
  { hours: 24,  label: '24 hours' },
  { hours: 48,  label: '48 hours' },
  { hours: 72,  label: '72 hours' },
  { hours: 168, label: '7 days' },
]

function Step4({
  form, setForm, onSubmit, submitting, submitError,
}: {
  form: ListingFormState
  setForm: (f: ListingFormState) => void
  onSubmit: () => void
  submitting: boolean
  submitError: string | null
}) {
  const pricePaisa = typeof form.reserve_price_pkr === 'number' ? form.reserve_price_pkr * 100 : 0
  const minPrice = 1000

  return (
    <div className="space-y-5">
      {/* Reserve price */}
      <div>
        <label className="text-[11px] font-medium text-text-muted block mb-1.5">
          Reserve price (Rs.) *
        </label>
        <input
          type="number"
          min={minPrice}
          placeholder="e.g. 85000"
          value={form.reserve_price_pkr}
          onChange={e => {
            const v = parseInt(e.target.value, 10)
            setForm({ ...form, reserve_price_pkr: isNaN(v) ? '' : v })
          }}
          className="w-full border border-border rounded-lg px-3 py-2.5 text-[13px] font-mono focus:outline-none focus:border-copper bg-surface"
        />
        {pricePaisa > 0 && (
          <p className="text-[11px] text-text-faint mt-1 font-mono">
            = {paisaToRs(pricePaisa)}
          </p>
        )}
        {typeof form.reserve_price_pkr === 'number' && form.reserve_price_pkr < minPrice && form.reserve_price_pkr > 0 && (
          <p className="text-[11px] text-danger mt-1">Minimum reserve price is Rs. 1,000</p>
        )}
        <p className="text-[10px] text-text-faint mt-1">The minimum bid amount. Bids below this are rejected.</p>
      </div>

      {/* Duration */}
      <div>
        <label className="text-[11px] font-medium text-text-muted block mb-2">Auction duration *</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DURATIONS.map(d => (
            <button
              key={d.hours}
              type="button"
              onClick={() => setForm({ ...form, auction_duration_hours: d.hours })}
              className={[
                'border-2 rounded-xl p-3 text-center transition-colors',
                form.auction_duration_hours === d.hours
                  ? 'border-copper bg-copper/5 text-copper'
                  : 'border-border text-text-muted hover:border-copper/40',
              ].join(' ')}
            >
              <p className="text-[13px] font-medium">{d.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Fee summary */}
      <div className="bg-cream border border-border rounded-xl p-4">
        <p className="text-[11px] font-medium text-text-muted mb-3">Fee structure</p>
        <div className="space-y-1.5">
          {[
            ['Platform fee', '2% of winning bid'],
            ['WHT', '1% of winning bid'],
            ['ICT tax', '15% of platform fees'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between text-[11px]">
              <span className="text-text-faint">{label}</span>
              <span className="font-mono">{val}</span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-faint mt-2 pt-2 border-t border-border">
          All fees deducted from escrowed funds at settlement.
        </p>
      </div>

      {/* Penalty acknowledgment */}
      <label className="flex items-start gap-3 cursor-pointer">
        <div
          onClick={() => setForm({ ...form, penalty_acknowledged: !form.penalty_acknowledged })}
          className={[
            'w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors cursor-pointer',
            form.penalty_acknowledged ? 'bg-copper border-copper' : 'border-border',
          ].join(' ')}
        >
          {form.penalty_acknowledged && <Check size={11} className="text-white" />}
        </div>
        <p className="text-[12px] text-text-muted leading-relaxed">
          I agree to the <span className="font-medium text-text-primary">Rs. 2,000 penalty deposit</span> required
          for listing. This is refunded when the listing settles at meetup.
        </p>
      </label>

      {/* Escrow notice */}
      <div className="bg-copper-light border border-copper-border rounded-xl p-3.5 flex gap-2.5">
        <ShieldCheck size={14} className="text-copper mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-obs leading-relaxed">
          Your listing goes live after AI vetting. Funds are held in escrow until
          IMEI verification and QR settlement at the physical meetup.
        </p>
      </div>

      {submitError && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
          <AlertCircle size={13} className="text-danger mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-danger">{submitError}</p>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={submitting}
        disabled={
          typeof form.reserve_price_pkr !== 'number' ||
          form.reserve_price_pkr < minPrice ||
          !form.penalty_acknowledged
        }
        onClick={onSubmit}
      >
        Launch Listing
        <ArrowRight size={15} />
      </Button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
function CreateListingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<ListingFormState>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Pick up IMEI returned from /sell/imei scanner
  useEffect(() => {
    const scannedImei = searchParams.get('imei')
    if (scannedImei) {
      setForm(prev => ({ ...prev, imei: scannedImei }))
      setStep(3)
    }
  }, [searchParams])

  // Warn on navigation away mid-form
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      const hasData = form.model || form.brand || form.imei || form.photos.length > 0
      if (hasData) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [form])

  // Step validation
  const canAdvanceStep1 = form.brand && form.model && form.storage && form.color && form.year
  const canAdvanceStep2 = !!form.condition
  const canAdvanceStep3 =
    luhnCheck(form.imei) && form.photos.length > 0

  const handleNext = () => setStep(s => Math.min(4, s + 1))
  const handleBack = () => setStep(s => Math.max(1, s - 1))

  const handleSubmit = useCallback(async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const fd = new FormData()
      fd.append('brand', form.brand)
      fd.append('model', form.model)
      fd.append('storage_gb', form.storage.replace(/[^0-9]/g, ''))
      fd.append('color_variant', form.color)
      fd.append('year', form.year)
      fd.append('condition', form.condition)
      fd.append('accessories', JSON.stringify(form.accessories))
      fd.append('warranty', form.warranty)
      fd.append('sim_slots', form.sim_slots)
      fd.append('battery_health', String(form.battery_health))
      fd.append('imei', form.imei)
      fd.append('reserve_price_paisa', String((form.reserve_price_pkr as number) * 100))
      fd.append('auction_duration_hours', String(form.auction_duration_hours))
      form.photos.forEach((photo, i) => fd.append(`photo_${i}`, photo))

      const res = await api.listings.create(fd)
      router.push(`/listings/${res.listing_id}`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Failed to create listing')
    } finally {
      setSubmitting(false)
    }
  }, [form, router])

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      {/* Breadcrumb */}
      <div className="bg-cream border-b border-border">
        <div className="max-w-[720px] mx-auto px-6 py-2.5">
          <nav className="text-[11px]">
            <span className="text-copper">Sell</span>
            <span className="text-text-faint mx-1.5">›</span>
            <span className="text-text-muted">Create listing</span>
          </nav>
        </div>
      </div>

      <main className="flex-1 bg-cream py-6">
        <div className="max-w-[720px] mx-auto px-6">

          {/* Header */}
          <h1 className="font-serif text-[24px] text-text-primary mb-1">List your device</h1>
          <p className="text-[12px] text-text-faint mb-6">
            Step {step} of {STEPS.length} — {STEPS[step - 1]}
          </p>

          <StepIndicator current={step} onClick={setStep} />

          {/* Form card */}
          <div className="bg-surface border border-border rounded-xl p-5 sm:p-6">
            {step === 1 && <Step1 form={form} setForm={setForm} />}
            {step === 2 && <Step2 form={form} setForm={setForm} />}
            {step === 3 && <Step3 form={form} setForm={setForm} router={router} />}
            {step === 4 && (
              <Step4
                form={form}
                setForm={setForm}
                onSubmit={handleSubmit}
                submitting={submitting}
                submitError={submitError}
              />
            )}

            {/* Navigation */}
            {step < 4 && (
              <div className="flex gap-3 mt-6 pt-5 border-t border-border">
                {step > 1 && (
                  <Button variant="secondary" size="md" onClick={handleBack}>
                    ← Back
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="md"
                  className="ml-auto"
                  disabled={
                    (step === 1 && !canAdvanceStep1) ||
                    (step === 2 && !canAdvanceStep2) ||
                    (step === 3 && !canAdvanceStep3)
                  }
                  onClick={handleNext}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function CreateListingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-full max-w-[720px] px-6 space-y-3">
          <div className="h-8 bg-border rounded animate-pulse w-48" />
          <div className="h-[400px] bg-border rounded-xl animate-pulse" />
        </div>
      </div>
    }>
      <CreateListingInner />
    </Suspense>
  )
}
