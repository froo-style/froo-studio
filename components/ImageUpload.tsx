'use client'

import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'

interface Props {
  onUpload: (files: { data: string; name: string }[]) => void
  label?: string
  multiple?: boolean
  brandPrimary?: string
}

export default function ImageUpload({ onUpload, label = 'Drop images here or click to upload', multiple = true, brandPrimary = '#C0392B' }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const readers = acceptedFiles.map(
        (file) =>
          new Promise<{ data: string; name: string }>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve({ data: reader.result as string, name: file.name })
            reader.readAsDataURL(file)
          })
      )
      Promise.all(readers).then(onUpload)
    },
    [onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    multiple,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
        isDragActive ? 'scale-[1.02]' : 'hover:border-opacity-70'
      }`}
      style={{ borderColor: isDragActive ? brandPrimary : '#D1D5DB' }}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}
