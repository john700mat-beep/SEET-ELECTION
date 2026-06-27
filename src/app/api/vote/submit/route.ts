import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseServer'
import { POSITIONS } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { voter_id, session_token, votes } = await req.json()

    if (!voter_id || !session_token || !votes || !Array.isArray(votes)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // 1. Verify session token
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('voter_sessions')
      .select('*')
      .eq('voter_id', voter_id)
      .eq('session_token', session_token)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid or expired session. Please start again.' }, { status: 401 })
    }

    // 2. Check session not expired
    if (new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Your session has expired. Please start again.' }, { status: 401 })
    }

    // 3. Check voter hasn't already voted
    const { data: voter } = await supabaseAdmin
      .from('voters')
      .select('has_voted')
      .eq('id', voter_id)
      .single()

    if (voter?.has_voted) {
      return NextResponse.json({ error: 'You have already voted.' }, { status: 403 })
    }

    // 4. Validate all positions are covered
    const votedPositions = votes.map((v: { position: string }) => v.position)
    const missingPositions = POSITIONS.filter(p => !votedPositions.includes(p))
    if (missingPositions.length > 0) {
      return NextResponse.json({ error: `Missing votes for: ${missingPositions.join(', ')}` }, { status: 400 })
    }

    // 5. Validate all candidate IDs exist
    const candidateIds = votes.map((v: { candidate_id: string }) => v.candidate_id)
    const { data: validCandidates } = await supabaseAdmin
      .from('candidates')
      .select('id, position')
      .in('id', candidateIds)

    if (!validCandidates || validCandidates.length !== votes.length) {
      return NextResponse.json({ error: 'Invalid candidate selection.' }, { status: 400 })
    }

    // 6. Insert votes
    const voteRows = votes.map((v: { position: string; candidate_id: string }) => ({
      voter_id,
      candidate_id: v.candidate_id,
      position: v.position,
    }))

    const { error: voteError } = await supabaseAdmin.from('votes').insert(voteRows)
    if (voteError) throw voteError

    // 7. Mark voter as voted
    await supabaseAdmin.from('voters').update({ has_voted: true }).eq('id', voter_id)

    // 8. Invalidate session
    await supabaseAdmin.from('voter_sessions').delete().eq('voter_id', voter_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Vote submission error:', err)
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 })
  }
}
