import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { imageData, textDescription } = await req.json()

    const content: Anthropic.MessageCreateParams['messages'][0]['content'] = []

    if (imageData) {
      const base64 = imageData.replace(/^data:image\/\w+;base64,/, '')
      const mediaType = imageData.startsWith('data:image/png') ? 'image/png' : 'image/jpeg'
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      })
    }

    content.push({
      type: 'text',
      text: `You are a senior garment technician analyzing a sample for a tech pack. ${textDescription ? `The designer described this as: "${textDescription}"` : ''}

Analyze this garment and provide structured notes in the following JSON format:
{
  "silhouette": "Overall silhouette and style description",
  "construction": "Construction details — seams, lining, interfacing",
  "closures": "Closure type and placement",
  "neckline": "Neckline and collar details",
  "sleeves": "Sleeve type and details",
  "hemFinish": "Hem finish description",
  "trims": ["list", "of", "each", "trim", "or", "embellishment"],
  "garmentType": "dress/top/skirt/pant/romper/jumpsuit/shorts/jacket/etc",
  "additionalNotes": "Any other factory-relevant notes",
  "needsLining": true/false,
  "detectedFabric": "Any fabric details visible or implied",
  "detectedSizeChart": false,
  "ambiguousDetails": ["list of details that are unclear or not visible and should be clarified"]
}

Be thorough — this goes to a factory. Include every visible detail about trims (embroidery, lace, smocking, pleats, piping, ruffles, buttons, bows, ribbons, etc). Return ONLY valid JSON.`,
    })

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    return NextResponse.json({ analysis, raw: text })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
