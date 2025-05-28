import { NextResponse } from 'next/server';
// import { supabase } from '../../../layout';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { inquiryId } = await request.json();
    // Delete inquiry from database
    const { error } = await supabase.from('inquiries').delete().eq('id', inquiryId);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete inquiry from database' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete inquiry from database:', err);
    return NextResponse.json({ error: 'Failed to delete inquiry from database' }, { status: 500 });
  }
}
