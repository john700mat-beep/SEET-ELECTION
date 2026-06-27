import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { key } = await req.json()
  const adminKey = process.env.ADMIN_KEY
  if (!adminKey) return NextResponse.json({ error: 'Admin key not configured' }, { status: 500 })
  if (key !== adminKey) return NextResponse.json({ error: 'Invalid key' }, { status: 401 })
  return NextResponse.json({ success: true })
}
