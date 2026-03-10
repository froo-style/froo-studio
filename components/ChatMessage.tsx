'use client'

import React from 'react'
import { ChatMessage as ChatMessageType } from '@/lib/types'

interface Props {
  message: ChatMessageType
  brandPrimary: string
  onButtonClick?: (value: string) => void
}

export default function ChatMessage({ message, brandPrimary, onButtonClick }: Props) {
  const isAssistant = message.role === 'assistant'

  return (
    <div className={`animate-fade-in-up flex ${isAssistant ? 'justify-start' : 'justify-end'} mb-4`}>
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-3.5 ${
          isAssistant
            ? 'bg-white shadow-sm border border-gray-100 text-gray-800'
            : 'text-white shadow-sm'
        }`}
        style={!isAssistant ? { backgroundColor: brandPrimary } : undefined}
      >
        {message.isLoading ? (
          <div className="flex items-center gap-1.5 py-1">
            <div className="typing-dot w-2 h-2 rounded-full bg-gray-400" />
            <div className="typing-dot w-2 h-2 rounded-full bg-gray-400" />
            <div className="typing-dot w-2 h-2 rounded-full bg-gray-400" />
          </div>
        ) : (
          <>
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</div>

            {message.images && message.images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.images.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt="Uploaded"
                    className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                  />
                ))}
              </div>
            )}

            {message.buttons && message.buttons.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.buttons.map((btn) => (
                  <button
                    key={btn.value}
                    onClick={() => onButtonClick?.(btn.value)}
                    className="px-4 py-2 rounded-full text-sm font-medium border-2 transition-all hover:scale-105 active:scale-95"
                    style={{
                      borderColor: brandPrimary,
                      color: btn.variant === 'primary' ? '#fff' : brandPrimary,
                      backgroundColor: btn.variant === 'primary' ? brandPrimary : 'transparent',
                    }}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
