'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  TechPackData, ChatMessage as ChatMessageType, Brand, Category, SampleSize,
  GeneratedVisual, FabricInfo, TrimInfo, DesignNotes, ButtonOption,
} from '@/lib/types'
import { getBrandTheme } from '@/lib/brands'
import { getNextSampleNumber } from '@/lib/sampleNumbers'
import { findMatchingCharts, SizeChartTemplate } from '@/lib/sizeCharts'
import ChatMessage from './ChatMessage'
import ImageUpload from './ImageUpload'
import StepIndicator from './StepIndicator'
import VisualsGallery from './VisualsGallery'
import TechPackPreview from './TechPackPreview'

type WizardPhase =
  | 'welcome'
  | 'ask-brand' | 'ask-category' | 'ask-size' | 'ask-image'
  | 'analyzing' | 'clarifying' | 'review-notes'
  | 'generating-visuals'
  | 'fabric-ready' | 'fabric-base' | 'fabric-base-input' | 'fabric-lining' | 'fabric-lining-input'
  | 'fabric-trims' | 'fabric-trim-input'
  | 'size-chart' | 'size-chart-upload' | 'size-chart-select'
  | 'complete'

const uid = () => Math.random().toString(36).slice(2, 10)

const INITIAL_TECH_PACK: TechPackData = {
  brand: null, category: null, sampleSize: null, sampleNumber: '',
  inspirationImage: null, designNotes: null, visuals: [],
  baseFabric: null, lining: null, trims: [], sizeChart: null,
  status: 'intake',
}

export default function TechPackWizard() {
  const [techPack, setTechPack] = useState<TechPackData>({ ...INITIAL_TECH_PACK })
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [phase, setPhase] = useState<WizardPhase>('welcome')
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [analysisResult, setAnalysisResult] = useState<Record<string, unknown> | null>(null)
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([])
  const [clarifyIndex, setClarifyIndex] = useState(0)
  const [detectedTrims, setDetectedTrims] = useState<string[]>([])
  const [currentTrimIndex, setCurrentTrimIndex] = useState(0)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const theme = getBrandTheme(techPack.brand)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  const addMessage = useCallback((msg: Omit<ChatMessageType, 'id'>) => {
    setMessages(prev => [...prev, { ...msg, id: uid() }])
  }, [])

  const addAssistant = useCallback((content: string, opts?: Partial<ChatMessageType>) => {
    addMessage({ role: 'assistant', content, ...opts })
  }, [addMessage])

  const addUser = useCallback((content: string, opts?: Partial<ChatMessageType>) => {
    addMessage({ role: 'user', content, ...opts })
  }, [addMessage])

  // Scroll on new messages
  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Phase machine
  useEffect(() => {
    switch (phase) {
      case 'welcome':
        addAssistant(
          "Welcome to the Tech Pack Generator! Let's build a factory-ready tech pack together.\n\nI'll guide you through four steps: intake, visuals, fabric, and sizing.\n\nFirst — which brand is this for?",
          {
            buttons: [
              { label: 'Froo', value: 'Froo' },
              { label: 'Sweet Threads', value: 'Sweet Threads' },
              { label: 'Prairie', value: 'Prairie' },
              { label: 'Soirée', value: 'Soirée' },
            ],
          }
        )
        setPhase('ask-brand')
        break

      case 'ask-category':
        addAssistant('What category?', {
          buttons: [
            { label: 'Baby', value: 'Baby' },
            { label: 'Girls', value: 'Girls' },
            { label: 'Boys', value: 'Boys' },
            { label: 'Preteen', value: 'Preteen' },
            { label: 'Teen', value: 'Teen' },
          ],
        })
        break

      case 'ask-size':
        addAssistant('Sample size?', {
          buttons: [
            { label: '2', value: '2' },
            { label: '6', value: '6' },
            { label: '8', value: '8' },
            { label: '16', value: '16' },
            { label: '18', value: '18' },
            { label: 'M', value: 'M' },
          ],
        })
        break

      case 'ask-image':
        addAssistant("Upload your inspiration image and any sample description. You can also upload fabric cards or size charts — I'll detect and use them automatically.")
        setShowUpload(true)
        setShowInput(true)
        break

      case 'analyzing':
        runAnalysis()
        break

      case 'clarifying':
        if (clarifyQuestions.length > 0 && clarifyIndex < clarifyQuestions.length) {
          addAssistant(clarifyQuestions[clarifyIndex])
          setShowInput(true)
        } else {
          setPhase('review-notes')
        }
        break

      case 'review-notes':
        if (techPack.designNotes) {
          addAssistant(
            `Here are the design notes I've compiled:\n\n` +
            `Silhouette: ${techPack.designNotes.silhouette}\n` +
            `Construction: ${techPack.designNotes.construction}\n` +
            `Closures: ${techPack.designNotes.closures}\n` +
            `Neckline: ${techPack.designNotes.neckline}\n` +
            `Sleeves: ${techPack.designNotes.sleeves}\n` +
            `Hem: ${techPack.designNotes.hemFinish}\n` +
            `Trims: ${techPack.designNotes.trims.join(', ')}\n` +
            `Notes: ${techPack.designNotes.additionalNotes}\n\n` +
            `Would you like to edit anything, or shall we proceed?`,
            {
              buttons: [
                { label: 'Looks good — continue', value: 'approve', variant: 'primary' },
                { label: 'Edit notes', value: 'edit' },
              ],
            }
          )
        }
        break

      case 'generating-visuals':
        setCurrentStep(2)
        generateVisuals()
        break

      case 'fabric-ready':
        setCurrentStep(3)
        addAssistant('Do you have your fabric and trim details ready?', {
          buttons: [
            { label: "Yes, let's go", value: 'yes', variant: 'primary' },
            { label: 'Come back to this later', value: 'later' },
          ],
        })
        break

      case 'fabric-base':
        addAssistant('How would you like to provide the base fabric?', {
          buttons: [
            { label: 'Upload fabric card', value: 'upload' },
            { label: 'Source options for me', value: 'ai-suggest' },
            { label: 'Factory to source', value: 'factory' },
          ],
        })
        break

      case 'fabric-lining': {
        const needsLining = analysisResult && (analysisResult as Record<string, unknown>).needsLining
        if (!needsLining) {
          addAssistant('Lining is not applicable for this garment. Moving to trims...')
          setTimeout(() => setPhase('fabric-trims'), 800)
        } else {
          addAssistant('How would you like to provide the lining details?', {
            buttons: [
              { label: 'Upload lining card', value: 'upload' },
              { label: 'Source options for me', value: 'ai-suggest' },
              { label: 'Factory to source', value: 'factory' },
            ],
          })
        }
        break
      }

      case 'fabric-trims':
        if (detectedTrims.length > 0 && currentTrimIndex < detectedTrims.length) {
          addAssistant(`For **${detectedTrims[currentTrimIndex]}** — how would you like to proceed?`, {
            buttons: [
              { label: 'Upload trim card', value: 'upload' },
              { label: 'Source options for me', value: 'ai-suggest' },
              { label: 'Factory to source', value: 'factory' },
            ],
          })
        } else if (detectedTrims.length === 0) {
          addAssistant('No trims detected. Moving to size chart...')
          setTimeout(() => setPhase('size-chart'), 800)
        } else {
          addAssistant('All trims captured! Moving to size chart...')
          setTimeout(() => setPhase('size-chart'), 800)
        }
        break

      case 'size-chart':
        setCurrentStep(4)
        if (techPack.sizeChart) {
          addAssistant('Size chart already detected from your uploads. Finalizing tech pack...')
          setTimeout(() => setPhase('complete'), 800)
        } else {
          addAssistant('How would you like to handle the size chart?', {
            buttons: [
              { label: 'Repeat Body', value: 'repeat' },
              { label: 'New Body', value: 'new' },
              { label: 'Upload Size Chart', value: 'upload' },
            ],
          })
        }
        break

      case 'complete':
        setTechPack(prev => ({ ...prev, status: 'complete' }))
        addAssistant('Your tech pack is ready! Review it below and export as PDF when you\'re satisfied.', {
          component: 'tech-pack-preview',
        })
        break
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function runAnalysis() {
    addAssistant('Analyzing your inspiration image for design details...', { isLoading: true })

    try {
      const res = await fetch('/api/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: techPack.inspirationImage,
          textDescription: inputValue,
        }),
      })
      const { analysis } = await res.json()

      if (analysis) {
        setAnalysisResult(analysis)
        const notes: DesignNotes = {
          silhouette: analysis.silhouette || '',
          construction: analysis.construction || '',
          closures: analysis.closures || '',
          neckline: analysis.neckline || '',
          sleeves: analysis.sleeves || '',
          hemFinish: analysis.hemFinish || '',
          trims: analysis.trims || [],
          additionalNotes: analysis.additionalNotes || '',
          rawText: JSON.stringify(analysis),
        }
        setTechPack(prev => ({ ...prev, designNotes: notes }))
        setDetectedTrims(analysis.trims || [])

        // Remove loading message and add success
        setMessages(prev => prev.filter(m => !m.isLoading))
        addAssistant('Image analysis complete!')

        if (analysis.ambiguousDetails && analysis.ambiguousDetails.length > 0) {
          setClarifyQuestions(analysis.ambiguousDetails)
          setClarifyIndex(0)
          setPhase('clarifying')
        } else {
          setPhase('review-notes')
        }
      }
    } catch {
      setMessages(prev => prev.filter(m => !m.isLoading))
      addAssistant('Image analysis encountered an issue. Let me ask some questions instead.')
      setPhase('review-notes')
    }
  }

  async function generateVisuals() {
    const garmentType = (analysisResult as Record<string, string>)?.garmentType || 'garment'
    const visualTypes: { type: string; label: string }[] = [
      { type: 'flat-front', label: 'Technical Flat — Front' },
      { type: 'flat-back', label: 'Technical Flat — Back' },
      { type: 'mockup-front', label: '3D Mockup — Front' },
      { type: 'mockup-back', label: '3D Mockup — Back' },
      { type: 'bg-removed', label: 'Background Removed' },
    ]

    // Add detail callouts
    if (techPack.designNotes?.trims) {
      techPack.designNotes.trims.forEach(trim => {
        visualTypes.push({ type: 'detail-callout', label: `Detail: ${trim}` })
      })
    }

    const visuals: GeneratedVisual[] = visualTypes.map(v => ({
      type: v.type as GeneratedVisual['type'],
      label: v.label,
      status: 'pending',
    }))

    setTechPack(prev => ({ ...prev, visuals, status: 'visuals' }))
    addAssistant('Generating sketches and mockups...', { component: 'visuals-gallery' })

    // Generate each visual sequentially (to avoid rate limits)
    for (let i = 0; i < visuals.length; i++) {
      visuals[i].status = 'generating'
      setTechPack(prev => ({ ...prev, visuals: [...visuals] }))

      try {
        await fetch('/api/generate-visuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: visuals[i].type,
            designNotes: techPack.designNotes?.rawText || '',
            inspirationImage: techPack.inspirationImage,
            garmentType,
          }),
        })
        visuals[i].status = 'done'
      } catch {
        visuals[i].status = 'error'
        visuals[i].error = 'Generation failed'
      }
      setTechPack(prev => ({ ...prev, visuals: [...visuals] }))
    }

    addAssistant('Sketches and mockups generated! Moving to fabric details...')
    setTimeout(() => setPhase('fabric-ready'), 1200)
  }

  async function handleSuggestFabric(requestType: string) {
    addAssistant('Finding fabric options for you...', { isLoading: true })
    try {
      const res = await fetch('/api/suggest-fabric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garmentType: (analysisResult as Record<string, string>)?.garmentType || 'garment',
          designNotes: techPack.designNotes,
          category: techPack.category,
          requestType,
        }),
      })
      const { suggestions } = await res.json()
      setMessages(prev => prev.filter(m => !m.isLoading))

      if (suggestions && suggestions.length > 0) {
        const buttons: ButtonOption[] = suggestions.map((s: Record<string, string>, i: number) => ({
          label: s.name || s.recommendation || `Option ${i + 1}`,
          value: JSON.stringify(s),
        }))
        addAssistant(
          'Here are my recommendations:\n\n' +
            suggestions
              .map((s: Record<string, string>, i: number) =>
                `${i + 1}. **${s.name || s.recommendation || s.type}**\n   ${s.composition || s.material || ''} — ${s.reason || s.feel || ''}`
              )
              .join('\n\n') +
            '\n\nSelect one:',
          { buttons }
        )
      } else {
        addAssistant('I couldn\'t find specific suggestions. Please type your fabric details:')
        setShowInput(true)
      }
    } catch {
      setMessages(prev => prev.filter(m => !m.isLoading))
      addAssistant('Couldn\'t fetch suggestions. Please type your fabric details:')
      setShowInput(true)
    }
  }

  function handleButtonClick(value: string) {
    switch (phase) {
      case 'ask-brand':
        addUser(value)
        setTechPack(prev => ({ ...prev, brand: value as Brand }))
        setPhase('ask-category')
        break

      case 'ask-category':
        addUser(value)
        setTechPack(prev => ({ ...prev, category: value as Category }))
        setPhase('ask-size')
        break

      case 'ask-size': {
        addUser(value)
        const brand = techPack.brand || 'Froo'
        const category = techPack.category || 'Girls'
        const sampleNum = getNextSampleNumber(brand, category)
        setTechPack(prev => ({
          ...prev,
          sampleSize: value as SampleSize,
          sampleNumber: sampleNum,
        }))
        addAssistant(`Sample number assigned: **${sampleNum}**`)
        setPhase('ask-image')
        break
      }

      case 'review-notes':
        if (value === 'approve') {
          addUser('Approved — continue')
          setPhase('generating-visuals')
        } else {
          addUser('I want to edit the notes')
          addAssistant('Type your corrections or additions:')
          setShowInput(true)
        }
        break

      case 'fabric-ready':
        addUser(value === 'yes' ? "Yes, let's go" : 'Come back later')
        if (value === 'later') {
          setTechPack(prev => ({ ...prev, status: 'draft' }))
          addAssistant('Tech pack saved as draft. Fabric & trims pages marked as "TBD — Pending".')
          setPhase('size-chart')
        } else {
          setPhase('fabric-base')
        }
        break

      case 'fabric-base':
        addUser(value === 'upload' ? 'Upload fabric card' : value === 'ai-suggest' ? 'Source options for me' : 'Factory to source')
        if (value === 'upload') {
          setShowUpload(true)
          setPhase('fabric-base-input')
        } else if (value === 'ai-suggest') {
          handleSuggestFabric('fabric')
          setPhase('fabric-base-input')
        } else {
          addAssistant('Type your fabric sourcing instruction for the factory:')
          setShowInput(true)
          setPhase('fabric-base-input')
        }
        break

      case 'fabric-base-input':
        // User selected an AI-suggested fabric
        try {
          const fabric = JSON.parse(value)
          const info: FabricInfo = {
            type: 'ai-suggested',
            description: fabric.name || fabric.recommendation || value,
            composition: fabric.composition || '',
            color: fabric.colorRec || '',
          }
          setTechPack(prev => ({ ...prev, baseFabric: info }))
          addUser(`Selected: ${info.description}`)
          addAssistant('Base fabric confirmed!')
          setPhase('fabric-lining')
        } catch {
          // Not JSON, treat as factory instruction
          const info: FabricInfo = { type: 'factory-source', description: value }
          setTechPack(prev => ({ ...prev, baseFabric: info }))
          addUser(value)
          addAssistant('Base fabric instruction noted!')
          setPhase('fabric-lining')
        }
        break

      case 'fabric-lining':
        addUser(value === 'upload' ? 'Upload lining card' : value === 'ai-suggest' ? 'Source options for me' : 'Factory to source')
        if (value === 'upload') {
          setShowUpload(true)
          setPhase('fabric-lining-input')
        } else if (value === 'ai-suggest') {
          handleSuggestFabric('lining')
          setPhase('fabric-lining-input')
        } else {
          addAssistant('Type your lining instruction for the factory:')
          setShowInput(true)
          setPhase('fabric-lining-input')
        }
        break

      case 'fabric-lining-input':
        try {
          const fabric = JSON.parse(value)
          const info: FabricInfo = {
            type: 'ai-suggested',
            description: fabric.name || fabric.recommendation || value,
            composition: fabric.composition || '',
          }
          setTechPack(prev => ({ ...prev, lining: info }))
          addUser(`Selected: ${info.description}`)
        } catch {
          const info: FabricInfo = { type: 'factory-source', description: value }
          setTechPack(prev => ({ ...prev, lining: info }))
          addUser(value)
        }
        addAssistant('Lining confirmed! Moving to trims...')
        setPhase('fabric-trims')
        break

      case 'fabric-trims': {
        const trimName = detectedTrims[currentTrimIndex]
        addUser(value === 'upload' ? 'Upload trim card' : value === 'ai-suggest' ? 'Source options for me' : 'Factory to source')
        if (value === 'upload') {
          setShowUpload(true)
          setPhase('fabric-trim-input')
        } else if (value === 'ai-suggest') {
          handleSuggestFabric('trim')
          setPhase('fabric-trim-input')
        } else {
          addAssistant(`Type your sourcing instruction for ${trimName}:`)
          setShowInput(true)
          setPhase('fabric-trim-input')
        }
        break
      }

      case 'fabric-trim-input': {
        const trimName = detectedTrims[currentTrimIndex]
        let trim: TrimInfo
        try {
          const parsed = JSON.parse(value)
          trim = {
            trimType: trimName,
            sourceType: 'ai-suggested',
            description: parsed.recommendation || parsed.name || value,
            color: parsed.color || '',
            usageNotes: parsed.size || '',
            vendorContact: parsed.vendor || '',
          }
        } catch {
          trim = {
            trimType: trimName,
            sourceType: 'factory-source',
            description: value,
          }
        }
        setTechPack(prev => ({ ...prev, trims: [...prev.trims, trim] }))
        addUser(trim.description)

        const nextIdx = currentTrimIndex + 1
        setCurrentTrimIndex(nextIdx)
        if (nextIdx < detectedTrims.length) {
          setPhase('fabric-trims')
        } else {
          addAssistant('All trims captured! Moving to size chart...')
          setTimeout(() => setPhase('size-chart'), 800)
        }
        break
      }

      case 'size-chart':
        addUser(value === 'repeat' ? 'Repeat Body' : value === 'new' ? 'New Body' : 'Upload Size Chart')
        if (value === 'upload') {
          setShowUpload(true)
          setPhase('size-chart-upload')
        } else if (value === 'repeat' || value === 'new') {
          const charts = findMatchingCharts(techPack.category || 'Girls')
          if (charts.length > 0) {
            const buttons: ButtonOption[] = charts.map(c => ({
              label: c.name,
              value: JSON.stringify(c),
            }))
            addAssistant('Select a size chart template:', { buttons })
            setPhase('size-chart-select')
          } else {
            addAssistant('No matching templates found. Please upload your size chart.')
            setShowUpload(true)
            setPhase('size-chart-upload')
          }
        }
        break

      case 'size-chart-select':
        try {
          const chart: SizeChartTemplate = JSON.parse(value)
          const chartData = Object.entries(chart.measurements)
            .map(([measurement, sizes]) => {
              const sizeStr = Object.entries(sizes).map(([s, v]) => `${s}: ${v}"`).join('  |  ')
              return `${measurement}: ${sizeStr}`
            })
            .join('\n')
          setTechPack(prev => ({
            ...prev,
            sizeChart: { type: 'repeat', data: chartData, name: chart.name },
          }))
          addUser(`Selected: ${chart.name}`)
          addAssistant('Size chart applied!')
          setTimeout(() => setPhase('complete'), 800)
        } catch {
          addUser(value)
          setTimeout(() => setPhase('complete'), 800)
        }
        break
    }
  }

  function handleTextSubmit() {
    if (!inputValue.trim()) return
    const val = inputValue.trim()
    setInputValue('')
    setShowInput(false)

    switch (phase) {
      case 'ask-image':
        // Text description provided along with (or without) image
        addUser(val)
        if (techPack.inspirationImage) {
          setPhase('analyzing')
        } else {
          addAssistant('Please also upload an inspiration image to continue.')
          setShowInput(true)
          setShowUpload(true)
        }
        break

      case 'clarifying':
        addUser(val)
        setClarifyIndex(prev => prev + 1)
        // Update notes with clarification
        if (techPack.designNotes) {
          const updatedNotes = { ...techPack.designNotes }
          updatedNotes.additionalNotes += `\n${clarifyQuestions[clarifyIndex]}: ${val}`
          setTechPack(prev => ({ ...prev, designNotes: updatedNotes }))
        }
        if (clarifyIndex + 1 < clarifyQuestions.length) {
          setTimeout(() => setPhase('clarifying'), 300)
        } else {
          setPhase('review-notes')
        }
        break

      case 'review-notes':
        addUser(val)
        if (techPack.designNotes) {
          const updatedNotes = { ...techPack.designNotes }
          updatedNotes.additionalNotes += `\nUser edit: ${val}`
          setTechPack(prev => ({ ...prev, designNotes: updatedNotes }))
        }
        addAssistant('Notes updated. Ready to continue?', {
          buttons: [
            { label: 'Continue to visuals', value: 'approve', variant: 'primary' },
            { label: 'Edit more', value: 'edit' },
          ],
        })
        break

      case 'fabric-base-input': {
        const info: FabricInfo = { type: 'factory-source', description: val }
        setTechPack(prev => ({ ...prev, baseFabric: info }))
        addUser(val)
        addAssistant('Base fabric instruction noted!')
        setPhase('fabric-lining')
        break
      }

      case 'fabric-lining-input': {
        const info: FabricInfo = { type: 'factory-source', description: val }
        setTechPack(prev => ({ ...prev, lining: info }))
        addUser(val)
        addAssistant('Lining instruction noted! Moving to trims...')
        setPhase('fabric-trims')
        break
      }

      case 'fabric-trim-input': {
        const trimName = detectedTrims[currentTrimIndex]
        const trim: TrimInfo = {
          trimType: trimName,
          sourceType: 'factory-source',
          description: val,
        }
        setTechPack(prev => ({ ...prev, trims: [...prev.trims, trim] }))
        addUser(val)

        const nextIdx = currentTrimIndex + 1
        setCurrentTrimIndex(nextIdx)
        if (nextIdx < detectedTrims.length) {
          setPhase('fabric-trims')
        } else {
          addAssistant('All trims captured! Moving to size chart...')
          setTimeout(() => setPhase('size-chart'), 800)
        }
        break
      }
    }
  }

  function handleImageUpload(files: { data: string; name: string }[]) {
    setShowUpload(false)
    const images = files.map(f => f.data)

    switch (phase) {
      case 'ask-image':
        addUser('Uploaded image(s)', { images })
        setTechPack(prev => ({ ...prev, inspirationImage: files[0].data }))
        // Check if we also have text
        if (inputValue.trim()) {
          handleTextSubmit()
        } else {
          setPhase('analyzing')
        }
        break

      case 'fabric-base-input': {
        const info: FabricInfo = { type: 'uploaded', description: 'Uploaded fabric card', imageData: files[0].data }
        setTechPack(prev => ({ ...prev, baseFabric: info }))
        addUser('Uploaded fabric card', { images })
        addAssistant('I detected a fabric card uploaded with your sample. Using it for the fabric section.')
        setPhase('fabric-lining')
        break
      }

      case 'fabric-lining-input': {
        const info: FabricInfo = { type: 'uploaded', description: 'Uploaded lining card', imageData: files[0].data }
        setTechPack(prev => ({ ...prev, lining: info }))
        addUser('Uploaded lining card', { images })
        addAssistant('Lining card captured! Moving to trims...')
        setPhase('fabric-trims')
        break
      }

      case 'fabric-trim-input': {
        const trimName = detectedTrims[currentTrimIndex]
        const trim: TrimInfo = {
          trimType: trimName,
          sourceType: 'uploaded',
          description: 'Uploaded trim card',
          imageData: files[0].data,
        }
        setTechPack(prev => ({ ...prev, trims: [...prev.trims, trim] }))
        addUser(`Uploaded ${trimName} card`, { images })

        const nextIdx = currentTrimIndex + 1
        setCurrentTrimIndex(nextIdx)
        if (nextIdx < detectedTrims.length) {
          setPhase('fabric-trims')
        } else {
          addAssistant('All trims captured! Moving to size chart...')
          setTimeout(() => setPhase('size-chart'), 800)
        }
        break
      }

      case 'size-chart-upload':
        setTechPack(prev => ({
          ...prev,
          sizeChart: { type: 'uploaded', imageData: files[0].data },
        }))
        addUser('Uploaded size chart', { images })
        addAssistant('Size chart uploaded!')
        setTimeout(() => setPhase('complete'), 800)
        break
    }
  }

  const showTechPackPreview = phase === 'complete'

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto">
      {/* Header */}
      <div className="no-print border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: theme.primary }}>
              {techPack.brand ? techPack.brand.charAt(0) : 'T'}
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-800">Tech Pack Generator</h1>
              <p className="text-xs text-gray-400">{techPack.brand || 'Select brand'} {techPack.sampleNumber && `· ${techPack.sampleNumber}`}</p>
            </div>
          </div>
        </div>
        <StepIndicator currentStep={currentStep} brandPrimary={theme.primary} />
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
        {messages.map(msg => (
          <React.Fragment key={msg.id}>
            <ChatMessage
              message={msg}
              brandPrimary={theme.primary}
              onButtonClick={handleButtonClick}
            />
            {msg.component === 'visuals-gallery' && (
              <div className="mb-4 ml-0">
                <VisualsGallery visuals={techPack.visuals} brandPrimary={theme.primary} />
              </div>
            )}
          </React.Fragment>
        ))}

        {showTechPackPreview && (
          <div className="mb-4">
            <TechPackPreview data={techPack} />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area */}
      {(showInput || showUpload) && (
        <div className="no-print border-t border-gray-100 bg-white px-4 py-3 space-y-3">
          {showUpload && (
            <ImageUpload
              onUpload={handleImageUpload}
              brandPrimary={theme.primary}
              label={
                phase === 'ask-image'
                  ? 'Drop inspiration images, fabric cards, or size charts'
                  : 'Drop your file here'
              }
            />
          )}
          {showInput && (
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-gray-400 transition-colors"
              />
              <button
                onClick={handleTextSubmit}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:opacity-90"
                style={{ backgroundColor: theme.primary }}
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
