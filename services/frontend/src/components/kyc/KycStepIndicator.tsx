import { CheckCircle2 } from 'lucide-react'

interface Props {
  currentStep: 1 | 2 | 3
  steps: string[]
}

export default function KycStepIndicator({ currentStep, steps }: Props) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((label, idx) => {
        const stepNum = idx + 1
        const isCompleted = stepNum < currentStep
        const isCurrent = stepNum === currentStep
        const connectorDone = isCompleted

        return (
          <div key={label} className="flex items-start">
            {/* Step circle + label */}
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-7 h-7 rounded-full flex items-center justify-center',
                  isCompleted ? 'bg-success text-white' :
                  isCurrent   ? 'bg-copper text-white' :
                  'bg-border text-text-faint border border-border',
                ].join(' ')}
              >
                {isCompleted ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <span className={`${isCurrent ? 'text-[12px] font-medium' : 'text-[12px]'}`}>
                    {stepNum}
                  </span>
                )}
              </div>
              <span
                className={[
                  'text-[9px] text-center mt-0.5 max-w-[60px] leading-tight',
                  isCompleted || isCurrent ? 'text-text-primary' : 'text-text-faint',
                ].join(' ')}
              >
                {label}
              </span>
            </div>

            {/* Connector line between steps */}
            {idx < steps.length - 1 && (
              <div
                className={[
                  'flex-1 h-px mt-3.5 min-w-[20px]',
                  connectorDone ? 'bg-success' : 'bg-border',
                ].join(' ')}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
