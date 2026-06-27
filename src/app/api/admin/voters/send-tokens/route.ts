import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'
import { isAdminAuthed } from '@/lib/adminAuth'

async function sendSMS(phone: string, message: string) {
  const apiKey = process.env.TERMII_API_KEY
  const senderId = process.env.TERMII_SENDER_ID ?? 'SEET Vote'

  const res = await fetch('https://api.ng.termii.com/api/sms/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phone,
      from: senderId,
      sms: message,
      type: 'plain',
      channel: 'generic',
      api_key: apiKey,
    }),
  })
  return res.ok
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Get all voters that haven't had token sent (token_used = false, has_voted = false)
    const { data: voters } = await supabaseAdmin
      .from('voters')
      .select('id, full_name, phone, token, matric_number')
      .eq('token_used', false)
      .eq('has_voted', false)

    if (!voters || voters.length === 0) {
      return NextResponse.json({ sent: 0, message: 'No pending voters found' })
    }

    let sent = 0
    let failed = 0

    for (const voter of voters) {
      const message = `Hello ${voter.full_name.split(' ')[0]}, your SEET Election voting token is: ${voter.token}\n\nMatric: ${voter.matric_number}\nVote at: ${process.env.NEXT_PUBLIC_APP_URL ?? 'your-site.vercel.app'}/vote\n\nThis token is for one-time use only.`
      
      const success = await sendSMS(voter.phone, message)
      if (success) sent++
      else failed++

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return NextResponse.json({ sent, failed })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to send tokens' }, { status: 500 })
  }
}
