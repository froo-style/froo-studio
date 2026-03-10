import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: NextRequest) {
  try {
    const { type, designNotes, inspirationImage, garmentType } = await req.json()
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '')

    const prompts: Record<string, string> = {
      'flat-front': `Create a professional technical flat sketch (front view) of a ${garmentType}. Black and white line drawing only, no shading, clean white background. Show all construction details: ${designNotes}. Fashion industry standard technical drawing style with clean precise lines.`,
      'flat-back': `Create a professional technical flat sketch (back view) of a ${garmentType}. Black and white line drawing only, no shading, clean white background. Show all construction details from the back: ${designNotes}. Fashion industry standard technical drawing style.`,
      'mockup-front': `Create a photorealistic 3D mockup (front view) of a ${garmentType} on an invisible mannequin/ghost mannequin. Realistic fabric texture and drape. White studio background. Details: ${designNotes}`,
      'mockup-back': `Create a photorealistic 3D mockup (back view) of a ${garmentType} on an invisible mannequin/ghost mannequin. Realistic fabric texture and drape. White studio background. Details: ${designNotes}`,
      'bg-removed': `Remove the background from this garment image. Keep only the garment on a clean white background. Professional product photography style.`,
      'detail-callout': `Create a detailed close-up illustration showing the construction detail of: ${designNotes}. Technical drawing style suitable for factory reference. Clean, precise, with clear labels.`,
    }

    const prompt = prompts[type] || prompts['flat-front']

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: prompt }]

    if (inspirationImage && (type === 'bg-removed' || type === 'mockup-front' || type === 'mockup-back')) {
      const base64 = inspirationImage.replace(/^data:image\/\w+;base64,/, '')
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64,
        },
      })
    }

    const result = await model.generateContent(parts)
    const response = result.response
    const text = response.text()

    return NextResponse.json({
      success: true,
      type,
      generatedText: text,
      note: 'Image generation requires Imagen API. Text description generated as placeholder.',
    })
  } catch (error) {
    console.error('Visual generation error:', error)
    return NextResponse.json({ error: `Failed to generate ${req.url}`, type: 'error' }, { status: 500 })
  }
}
