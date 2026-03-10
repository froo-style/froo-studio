'use client'

import React from 'react'
import { GeneratedVisual } from '@/lib/types'

interface Props {
  visuals: GeneratedVisual[]
  brandPrimary: string
}

export default function VisualsGallery({ visuals, brandPrimary }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
      {visuals.map((v, i) => (
        <div key={i} className="relative rounded-xl overflow-hidden border border-gray-200 bg-white">
          <div className="aspect-square flex items-center justify-center bg-gray-50">
            {v.status === 'generating' && (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: brandPrimary, borderTopColor: 'transparent' }}
                />
                <span className="text-xs text-gray-400">Generating...</span>
              </div>
            )}
            {v.status === 'done' && v.imageData && (
              <img src={v.imageData} alt={v.label} className="w-full h-full object-cover" />
            )}
            {v.status === 'done' && !v.imageData && (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs text-gray-400">AI visual placeholder</span>
              </div>
            )}
            {v.status === 'error' && (
              <div className="flex flex-col items-center gap-2 p-4 text-center">
                <span className="text-xs text-red-400">Generation failed</span>
                <span className="text-xs text-gray-400">{v.error}</span>
              </div>
            )}
            {v.status === 'pending' && (
              <div className="flex flex-col items-center gap-2 p-4">
                <div className="w-6 h-6 rounded-full bg-gray-200" />
                <span className="text-xs text-gray-400">Queued</span>
              </div>
            )}
          </div>
          <div className="px-3 py-2 text-xs font-medium text-gray-600 bg-white border-t border-gray-100">
            {v.label}
          </div>
        </div>
      ))}
    </div>
  )
}
