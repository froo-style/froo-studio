import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { garmentType, designNotes, category, requestType } = await req.json()

    const typePrompts: Record<string, string> = {
      fabric: `You are a senior garment technician and fabric sourcing expert. Based on this garment:
Type: ${garmentType}
Category: ${category}
Design Notes: ${JSON.stringify(designNotes)}

Suggest 3 fabric options for the BASE FABRIC. For each, provide:
- Fabric name and composition (e.g., "100% Cotton Poplin")
- Weight (GSM)
- Hand feel description
- Why it's suitable
- Estimated price range per yard

Return as JSON array: [{"name": "...", "composition": "...", "weight": "...", "feel": "...", "reason": "...", "priceRange": "..."}]`,
      lining: `You are a senior garment technician. Based on this garment:
Type: ${garmentType}
Category: ${category}
Design Notes: ${JSON.stringify(designNotes)}

Suggest 2-3 lining fabric options. For each, provide:
- Fabric name and composition
- Weight
- Why it's suitable for this garment
- Color recommendation

Return as JSON array: [{"name": "...", "composition": "...", "weight": "...", "reason": "...", "colorRec": "..."}]`,
      trim: `You are a senior garment technician and trim sourcing expert. Based on this garment:
Type: ${garmentType}
Design Notes: ${JSON.stringify(designNotes)}

Suggest appropriate trim options. For each trim type needed, provide:
- Trim type (e.g., lace, ribbon, button)
- Specific recommendation
- Material and finish
- Size/width
- Color suggestion
- Estimated price

Return as JSON array: [{"type": "...", "recommendation": "...", "material": "...", "size": "...", "color": "...", "price": "..."}]`,
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: typePrompts[requestType] || typePrompts.fabric }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('Fabric suggestion error:', error)
    return NextResponse.json({ error: 'Failed to suggest fabrics' }, { status: 500 })
  }
}
