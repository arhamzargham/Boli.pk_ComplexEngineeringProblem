'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ShieldCheck, UploadCloud, File, Info } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Button from '@/components/ui/Button'
import KycStepIndicator from '@/components/kyc/KycStepIndicator'
import { isAuthenticated } from '@/lib/auth'

const STEPS = ['Personal', 'Documents', 'Review']

interface FormData {
  fullName: string
  cnic: string
  dateOfBirth: string
  cnicFrontFile: File | null
  cnicBackFile: File | null
}

function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 13)
  if (digits.length <= 5) return digits
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`
}

export default function KycPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    cnic: '',
    dateOfBirth: '',
    cnicFrontFile: null,
    cnicBackFile: null,
  })

  const frontRef = useRef<HTMLInputElement>(null)
  const backRef  = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!isAuthenticated()) router.push('/login')
  }, [router])

  function validateStep1(): boolean {
    if (formData.fullName.trim().length < 3) {
      setError('Please enter your full name (at least 3 characters)')
      return false
    }
    if (!/^\d{5}-\d{7}-\d{1}$/.test(formData.cnic)) {
      setError('Please enter a valid CNIC (e.g., 12345-1234567-1)')
      return false
    }
    if (!formData.dateOfBirth) {
      setError('Please enter your date of birth')
      return false
    }
    return true
  }

  function validateStep2(): boolean {
    if (!formData.cnicFrontFile || !formData.cnicBackFile) {
      setError('Please upload both CNIC front and back images')
      return false
    }
    return true
  }

  function handleStep1Continue() {
    setError(null)
    if (validateStep1()) setStep(2)
  }

  function handleStep2Continue() {
    setError(null)
    if (validateStep2()) setStep(3)
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)
    await new Promise(res => setTimeout(res, 1500))
    setLoading(false)
    setSubmitted(true)
  }

  const formatDob = (iso: string) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar variant="minimal" />

      <div className="flex-1 bg-obs flex flex-col items-center justify-center px-4 py-8">
        <div className="bg-surface rounded-xl border border-border p-7 w-full max-w-[480px]">

          {submitted ? (
            /* Success state */
            <div className="text-center">
              <CheckCircle2 size={40} className="text-success mx-auto" />
              <p className="font-serif text-[22px] mt-3">KYC Submitted</p>
              <p className="text-[12px] text-text-muted mt-2 max-w-[280px] mx-auto">
                Your documents are under review. You will be notified via SMS when your tier is
                upgraded to FULL. This typically takes 24 hours.
              </p>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => router.push('/')}
                className="mt-4"
              >
                Return to Home
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-0">
                <span className="font-serif text-[20px] text-obs">Boli.pk</span>
                <p className="text-[11px] text-text-faint italic mt-0.5">KYC Verification</p>
              </div>

              <div className="mt-5 mb-5">
                <KycStepIndicator currentStep={step} steps={STEPS} />
              </div>

              {/* Step 1 — Personal details */}
              {step === 1 && (
                <div>
                  <h2 className="font-serif text-[18px] mb-4">Personal details</h2>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                        Full name (as on CNIC)
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={e => setFormData(p => ({ ...p, fullName: e.target.value }))}
                        placeholder="Muhammad Ali"
                        className="w-full text-[13px] border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                        CNIC number
                      </label>
                      <input
                        type="text"
                        value={formData.cnic}
                        onChange={e => setFormData(p => ({ ...p, cnic: formatCnic(e.target.value) }))}
                        placeholder="12345-1234567-1"
                        maxLength={15}
                        className="w-full text-[13px] font-mono border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-text-muted block mb-1.5">
                        Date of birth
                      </label>
                      <input
                        type="date"
                        value={formData.dateOfBirth}
                        max={today}
                        onChange={e => setFormData(p => ({ ...p, dateOfBirth: e.target.value }))}
                        className="w-full text-[13px] border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-[11px] text-danger mt-3">{error}</p>
                  )}

                  <Button variant="primary" size="md" fullWidth onClick={handleStep1Continue} className="mt-4">
                    Continue
                  </Button>
                </div>
              )}

              {/* Step 2 — Document upload */}
              {step === 2 && (
                <div>
                  <h2 className="font-serif text-[18px] mb-4">Upload CNIC</h2>

                  {(['Front', 'Back'] as const).map((side, idx) => {
                    const file = idx === 0 ? formData.cnicFrontFile : formData.cnicBackFile
                    const ref  = idx === 0 ? frontRef : backRef
                    const key  = idx === 0 ? 'cnicFrontFile' : 'cnicBackFile'
                    return (
                      <div key={side} className="mb-3">
                        <label className="text-[11px] font-medium text-text-muted block mb-1">
                          CNIC {side}
                        </label>
                        <div
                          className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center hover:border-copper/40 transition-colors cursor-pointer"
                          onClick={() => ref.current?.click()}
                        >
                          {file ? (
                            <>
                              <CheckCircle2 size={16} className="text-success mb-1" />
                              <p className="text-[11px] text-text-primary">{file.name}</p>
                              <button
                                className="text-[10px] text-copper mt-1 hover:underline"
                                onClick={e => { e.stopPropagation(); ref.current?.click() }}
                              >
                                Change
                              </button>
                            </>
                          ) : (
                            <>
                              <UploadCloud size={24} className="text-text-faint mb-2" />
                              <p className="text-[11px] text-text-faint">Click to upload · JPG or PNG</p>
                              <p className="text-[10px] text-text-faint mt-0.5">Max 5 MB</p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          ref={ref}
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0] ?? null
                            setFormData(p => ({ ...p, [key]: f }))
                          }}
                        />
                      </div>
                    )
                  })}

                  <div className="bg-cream rounded-lg p-2.5 mt-1 flex gap-2 items-start">
                    <Info size={11} className="text-text-faint mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-text-muted">
                      Documents are encrypted and stored securely. Never shared with buyers or sellers.
                    </p>
                  </div>

                  {error && <p className="text-[11px] text-danger mt-3">{error}</p>}

                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" size="md" onClick={() => { setError(null); setStep(1) }}>
                      ← Back
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      disabled={!formData.cnicFrontFile || !formData.cnicBackFile}
                      onClick={handleStep2Continue}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3 — Review + submit */}
              {step === 3 && (
                <div>
                  <h2 className="font-serif text-[18px] mb-4">Review your details</h2>

                  <div className="bg-cream rounded-xl p-4 space-y-2">
                    {[
                      { label: 'Full name', value: formData.fullName, mono: false },
                      { label: 'CNIC',      value: formData.cnic,      mono: true  },
                      { label: 'DOB',       value: formatDob(formData.dateOfBirth), mono: false },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-[11px]">
                        <span className="text-text-faint">{row.label}</span>
                        <span className={row.mono ? 'font-mono' : ''}>{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-3">
                    {[
                      formData.cnicFrontFile,
                      formData.cnicBackFile,
                    ].map((f, i) => (
                      <div key={i} className="flex-1 h-[60px] bg-obs-90 rounded-lg flex flex-col items-center justify-center gap-1">
                        <File size={14} className="text-copper/60" />
                        <span className="text-[9px] text-copper/60 text-center px-1 truncate w-full text-center">
                          {f?.name ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-cream rounded-lg p-2.5 mt-3 flex gap-2 items-start">
                    <ShieldCheck size={12} className="text-copper mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-text-muted leading-relaxed">
                      By submitting, you agree to the Boli.pk KYC policy. Verification typically
                      completes within 24 hours.
                    </p>
                  </div>

                  {error && <p className="text-[11px] text-danger mt-3">{error}</p>}

                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" size="md" onClick={() => { setError(null); setStep(2) }}>
                      ← Back
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      className="flex-1"
                      loading={loading}
                      onClick={handleSubmit}
                    >
                      Submit KYC
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <p className="text-[10px] text-white/30 text-center mt-4">
          KYC is required to bid above Rs. 50,000 or list a device
        </p>
      </div>
    </div>
  )
}
