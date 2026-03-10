'use client'

import React from 'react'

interface Props {
  currentStep: number
  brandPrimary: string
}

const steps = [
  { num: 1, label: 'Intake' },
  { num: 2, label: 'Visuals' },
  { num: 3, label: 'Fabric' },
  { num: 4, label: 'Size Chart' },
]

export default function StepIndicator({ currentStep, brandPrimary }: Props) {
  return (
    <div className="flex items-center justify-center gap-1 py-3">
      {steps.map((step, i) => {
        const isActive = step.num === currentStep
        const isComplete = step.num < currentStep
        return (
          <React.Fragment key={step.num}>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  isComplete
                    ? 'text-white'
                    : isActive
                    ? 'text-white shadow-md scale-110'
                    : 'bg-gray-200 text-gray-400'
                }`}
                style={
                  isActive || isComplete ? { backgroundColor: brandPrimary } : undefined
                }
              >
                {isComplete ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.num
                )}
              </div>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  isActive ? 'text-gray-800' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-8 h-0.5 rounded-full mx-1"
                style={{ backgroundColor: step.num < currentStep ? brandPrimary : '#E5E7EB' }}
              />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
