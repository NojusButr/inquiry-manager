import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/utils/supabase/server';

const supabase = await createClient();

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
);

interface PostRequestBody {
  inquiryId: string;
  message: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: PostRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { inquiryId, message } = body;

  const { data: inquiry, error: inquiryError } = await supabase
    .from('inquiries')
    .select('email_account_id, thread_id')
    .eq('id', inquiryId)
    .single();

  if (inquiryError || !inquiry) {
    return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
  }

  const { data: emailAccount, error: accountError } = await supabase
    .from('email_accounts')
    .select('refresh_token')
    .eq('id', inquiry.email_account_id)
    .single();

  if (accountError || !emailAccount) {
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
  }

  oauth2Client.setCredentials({ refresh_token: emailAccount.refresh_token });

  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) throw new Error('Failed to retrieve access token');

    oauth2Client.setCredentials({ access_token: token });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const rawMessage = Buffer.from(
      `Content-Type: text/plain; charset="UTF-8"\n` +
      `MIME-Version: 1.0\n` +
      `To: someone@example.com\n` + // Placeholder: adjust if sending a new message
      `Subject: Re: your inquiry\n\n` +
      `${message}`
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        threadId: inquiry.thread_id,
        raw: rawMessage,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error sending reply:', err);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }
}
