import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: votes } = await supabaseAdmin
    .from('votes')
    .select('candidate_id, position, candidates(name)')

  const counts: Record<string, { candidate_id: string; candidate_name: string; position: string; vote_count: number }> = {}

  for (const vote of votes ?? []) {
    const key = vote.candidate_id
    if (!counts[key]) {
      counts[key] = {
        candidate_id: vote.candidate_id,
        candidate_name: (vote.candidates as { name: string })?.name ?? 'Unknown',
        position: vote.position,
        vote_count: 0,
      }
    }
    counts[key].vote_count++
  }

  return NextResponse.json(Object.values(counts))
}
