import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const { matric_number, token } = await req.json()

    if (!matric_number || !token) {
      return NextResponse.json({ error: 'Matric number and token are required' }, { status: 400 })
    }

    // 1. Find voter by matric number
    const { data: voter, error: voterError } = await supabaseAdmin
      .from('voters')
      .select('*')
      .eq('matric_number', matric_number.toUpperCase())
      .single()

    if (voterError || !voter) {
      return NextResponse.json({ error: 'Matric number not found. Contact the electoral committee.' }, { status: 404 })
    }

    // 2. Check if already voted
    if (voter.has_voted) {
      return NextResponse.json({ error: 'This matric number has already been used to vote.' }, { status: 403 })
    }

    // 3. Check if token is already used
    if (voter.token_used) {
      return NextResponse.json({ error: 'This token has already been used.' }, { status: 403 })
    }

    // 4. Verify token matches
    if (voter.token !== token.toUpperCase().replace(/\s/g, '')) {
      return NextResponse.json({ error: 'Invalid token. Check your SMS/WhatsApp message.' }, { status: 401 })
    }

    // 5. Mark token as used (prevents reuse even if they don't finish voting)
    await supabaseAdmin
      .from('voters')
      .update({ token_used: true })
      .eq('id', voter.id)

    // 6. Generate short-lived session token (valid for this voting session only)
    const sessionToken = uuidv4()
    await supabaseAdmin
      .from('voter_sessions')
      .insert({ voter_id: voter.id, session_token: sessionToken, expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() })

    // 7. Fetch all candidates
    const { data: candidates } = await supabaseAdmin
      .from('candidates')
      .select('*')
      .order('position', { ascending: true })
      .order('name', { ascending: true })

    return NextResponse.json({
      voter: {
        voter_id: voter.id,
        full_name: voter.full_name,
        matric_number: voter.matric_number,
        session_token: sessionToken,
      },
      candidates,
    })
  } catch (err) {
    console.error('Auth error:', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
