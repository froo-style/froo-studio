import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { designNotes, userResponse, currentQuestion } = await req.json()

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are a senior garment technician creating a tech pack. Here are the current design notes:

${JSON.stringify(designNotes, null, 2)}

The user was asked: "${currentQuestion}"
They responded: "${userResponse}"

Update the design notes incorporating their response. Return updated notes as JSON in the same format. Also suggest any remaining clarification questions needed for factory clarity. Return format:
{
  "updatedNotes": { ...updated design notes... },
  "remainingQuestions": ["question1", "question2"],
  "clarificationsComplete": true/false
}

Return ONLY valid JSON.`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null

    return NextResponse.json({ result })
  } catch (error) {
    console.error('Clarify error:', error)
    return NextResponse.json({ error: 'Failed to process clarification' }, { status: 500 })
  }
}
