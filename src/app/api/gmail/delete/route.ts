import { NextResponse } from 'next/server';
// import { supabase } from '../../../layout';
import { createClient } from '@/utils/supabase/server';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { inquiryId } = await request.json();
    // Fetch inquiry to get original_id and email_account_id
    const { data: inquiry, error: inquiryError } = await supabase
      .from('inquiries')
      .select('original_id, email_account_id')
      .eq('id', inquiryId)
      .single();
    if (inquiryError || !inquiry) {
      return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
    }
    // Fetch email account for tokens
    const { data: emailAccount, error: emailAccountError } = await supabase
      .from('email_accounts')
      .select('access_token, refresh_token')
      .eq('id', inquiry.email_account_id)
      .single();
    if (emailAccountError || !emailAccount) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
    }
    // Delete from Gmail if possible
    if (inquiry.original_id) {
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
        );
        oauth2Client.setCredentials({
          access_token: emailAccount.access_token,
          refresh_token: emailAccount.refresh_token,
        });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        await gmail.users.messages.delete({ userId: 'me', id: inquiry.original_id });
      } catch (err) {
        // Log but do not fail if Gmail deletion fails
        console.error('Failed to delete from Gmail:', err);
      }
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to delete from Gmail:', err);
    return NextResponse.json({ error: 'Failed to delete from Gmail' }, { status: 500 });
  }
}
