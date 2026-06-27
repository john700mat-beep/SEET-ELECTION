import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminAuthed } from '@/lib/adminAuth'

export async function GET(req: NextRequest) {
  if (!isAdminAuthed(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data } = await supabaseAdmin
    .from('voters')
    .select('id, matric_number, full_name, department, level, phone, has_voted, token_used, token')
    .order('full_name')
  return NextResponse.json(data ?? [])
}
