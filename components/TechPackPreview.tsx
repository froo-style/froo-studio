'use client'

import React, { useRef } from 'react'
import { TechPackData } from '@/lib/types'
import { getBrandTheme } from '@/lib/brands'

interface Props {
  data: TechPackData
}

export default function TechPackPreview({ data }: Props) {
  const theme = getBrandTheme(data.brand)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleExportPDF = async () => {
    const el = containerRef.current
    if (!el) return
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default
    const pages = el.querySelectorAll<HTMLElement>('.tp-page')
    const pdf = new jsPDF('p', 'mm', 'a4')
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' })
      const imgData = canvas.toDataURL('image/png')
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297)
    }
    pdf.save(`TechPack_${data.sampleNumber || 'draft'}.pdf`)
  }

  const isDraft = data.status === 'draft'

  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Tech Pack Preview</h3>
        <button
          onClick={handleExportPDF}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
          style={{ backgroundColor: theme.primary }}
        >
          Export PDF
        </button>
      </div>

      <div ref={containerRef} className="space-y-6">
        {/* PAGE 1 — Design Overview */}
        <div className="tp-page bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ minHeight: '842px' }}>
          {/* Header */}
          <div className="px-8 py-5 flex items-center justify-between" style={{ backgroundColor: theme.primary }}>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ color: theme.textOnPrimary }}>
                {data.brand || 'Brand'}
              </h1>
              <p className="text-sm mt-0.5 opacity-80" style={{ color: theme.textOnPrimary }}>TECH PACK</p>
            </div>
            <div className="text-right text-sm" style={{ color: theme.textOnPrimary }}>
              <p className="font-semibold">{data.sampleNumber || '—'}</p>
              <p className="opacity-80">{data.category} &middot; Size {data.sampleSize}</p>
            </div>
          </div>

          <div className="p-8">
            {/* Garment images */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              {data.inspirationImage && (
                <div className="space-y-1">
                  <div className="aspect-square bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                    <img src={data.inspirationImage} alt="Inspiration" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-xs text-gray-500 text-center">Inspiration</p>
                </div>
              )}
              {data.visuals.filter(v => v.status === 'done').map((v, i) => (
                <div key={i} className="space-y-1">
                  <div className="aspect-square bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center">
                    {v.imageData ? (
                      <img src={v.imageData} alt={v.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-3">
                        <svg className="w-8 h-8 mx-auto text-gray-300 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-[10px] text-gray-400">{v.label}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 text-center">{v.label}</p>
                </div>
              ))}
            </div>

            {/* Design Notes */}
            {data.designNotes && (
              <div className="border rounded-lg p-5" style={{ borderColor: theme.primary + '30' }}>
                <h3 className="font-semibold text-sm mb-3" style={{ color: theme.primary }}>FACTORY NOTES</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  {data.designNotes.silhouette && <p><span className="font-medium">Silhouette:</span> {data.designNotes.silhouette}</p>}
                  {data.designNotes.construction && <p><span className="font-medium">Construction:</span> {data.designNotes.construction}</p>}
                  {data.designNotes.closures && <p><span className="font-medium">Closures:</span> {data.designNotes.closures}</p>}
                  {data.designNotes.neckline && <p><span className="font-medium">Neckline:</span> {data.designNotes.neckline}</p>}
                  {data.designNotes.sleeves && <p><span className="font-medium">Sleeves:</span> {data.designNotes.sleeves}</p>}
                  {data.designNotes.hemFinish && <p><span className="font-medium">Hem:</span> {data.designNotes.hemFinish}</p>}
                  {data.designNotes.trims && data.designNotes.trims.length > 0 && (
                    <p><span className="font-medium">Trims:</span> {data.designNotes.trims.join(', ')}</p>
                  )}
                  {data.designNotes.additionalNotes && <p><span className="font-medium">Additional:</span> {data.designNotes.additionalNotes}</p>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PAGE 2 — Fabric & Trims */}
        <div className="tp-page bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ minHeight: '842px' }}>
          <div className="px-8 py-4 border-b" style={{ backgroundColor: theme.secondary, borderColor: theme.primary + '20' }}>
            <h2 className="text-lg font-semibold" style={{ color: theme.primary }}>Fabric &amp; Trims</h2>
            <p className="text-xs text-gray-500">{data.sampleNumber} &middot; {data.brand}</p>
          </div>

          <div className="p-8 space-y-6">
            {/* Base Fabric */}
            <div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: theme.primary }}>BASE FABRIC</h3>
              {data.baseFabric ? (
                <div className="border rounded-lg p-4 border-gray-200">
                  <div className="flex gap-4">
                    {data.baseFabric.imageData && (
                      <img src={data.baseFabric.imageData} alt="Fabric" className="w-24 h-24 object-cover rounded-lg" />
                    )}
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{data.baseFabric.description}</p>
                      {data.baseFabric.composition && <p className="text-gray-500">Composition: {data.baseFabric.composition}</p>}
                      {data.baseFabric.color && <p className="text-gray-500">Color: {data.baseFabric.color}</p>}
                      {data.baseFabric.vendorName && <p className="text-gray-500">Vendor: {data.baseFabric.vendorName}</p>}
                      {data.baseFabric.vendorContact && <p className="text-gray-500">Contact: {data.baseFabric.vendorContact}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-sm text-gray-400">
                  TBD — Pending Fabric Selection
                </div>
              )}
            </div>

            {/* Lining */}
            <div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: theme.primary }}>LINING</h3>
              {data.lining ? (
                <div className="border rounded-lg p-4 border-gray-200">
                  <div className="flex gap-4">
                    {data.lining.imageData && (
                      <img src={data.lining.imageData} alt="Lining" className="w-24 h-24 object-cover rounded-lg" />
                    )}
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{data.lining.description}</p>
                      {data.lining.composition && <p className="text-gray-500">Composition: {data.lining.composition}</p>}
                      {data.lining.vendorName && <p className="text-gray-500">Vendor: {data.lining.vendorName}</p>}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-sm text-gray-400">
                  {isDraft ? 'TBD — Pending' : 'Not applicable'}
                </div>
              )}
            </div>

            {/* Trims */}
            <div>
              <h3 className="font-semibold text-sm mb-2" style={{ color: theme.primary }}>TRIMS &amp; NOTIONS</h3>
              {data.trims.length > 0 ? (
                <div className="border rounded-lg overflow-hidden border-gray-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: theme.secondary }}>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Type</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Color</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-600">Vendor/Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.trims.map((trim, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 font-medium">{trim.trimType}</td>
                          <td className="px-4 py-2">{trim.description}</td>
                          <td className="px-4 py-2">{trim.color || '—'}</td>
                          <td className="px-4 py-2">{trim.vendorContact || trim.usageNotes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center text-sm text-gray-400">
                  {isDraft ? 'TBD — Pending' : 'No trims specified'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PAGE 3 — Size Chart */}
        <div className="tp-page bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" style={{ minHeight: '842px' }}>
          <div className="px-8 py-4 border-b" style={{ backgroundColor: theme.secondary, borderColor: theme.primary + '20' }}>
            <h2 className="text-lg font-semibold" style={{ color: theme.primary }}>Size &amp; Measurement</h2>
            <p className="text-xs text-gray-500">{data.sampleNumber} &middot; Sample Size: {data.sampleSize}</p>
          </div>

          <div className="p-8">
            {data.sizeChart ? (
              <div>
                {data.sizeChart.imageData && (
                  <img src={data.sizeChart.imageData} alt="Size Chart" className="max-w-full rounded-lg border border-gray-200" />
                )}
                {data.sizeChart.data && (
                  <div className="mt-4 text-sm whitespace-pre-wrap font-mono bg-gray-50 p-4 rounded-lg">
                    {data.sizeChart.data}
                  </div>
                )}
                {data.sizeChart.name && (
                  <p className="mt-2 text-sm text-gray-500">Template: {data.sizeChart.name}</p>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
                {isDraft ? 'TBD — Pending Size Chart' : 'No size chart attached'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
