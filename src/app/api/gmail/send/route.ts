import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { google } from 'googleapis';

export async function POST(req: Request) {
  const supabase = await createClient();
  try {
    const body = await req.json();
    const { emailAccountId, to, subject, message, threadId, inReplyTo, references, sentBy } = body;
    // 1. Get the email account and tokens
    const { data: account, error: accountError } = await supabase
      .from('email_accounts')
      .select('id, email_address, access_token, refresh_token')
      .eq('id', emailAccountId)
      .single();
    if (accountError || !account) {
      return NextResponse.json({ error: 'Email account not found' }, { status: 400 });
    }
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );
    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
    });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    // 2. Build raw email
    const headers = [
      `From: ${account.email_address}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
    ];
    if (threadId) headers.push(`Thread-Id: ${threadId}`);
    if (inReplyTo) headers.push(`In-Reply-To: ${inReplyTo}`);
    if (references) headers.push(`References: ${references}`);
    const raw = Buffer.from(headers.join('\r\n') + '\r\n\r\n' + message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    // 3. Send email
    const gmailRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw,
        threadId: threadId || undefined,
      },
    });
    // 4. Store in sent_emails table
    await supabase.from('sent_emails').insert({
      email_account_id: account.id,
      to,
      subject,
      body: message,
      sent_at: new Date().toISOString(),
      thread_id: gmailRes.data.threadId || threadId || null,
      original_id: gmailRes.data.id,
      in_reply_to: inReplyTo || null,
      references: references || null,
      sent_by: sentBy || null,
    });
    return NextResponse.json({ success: true, id: gmailRes.data.id, threadId: gmailRes.data.threadId });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
