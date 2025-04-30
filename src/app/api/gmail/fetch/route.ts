import { NextResponse } from 'next/server';
import { supabase } from '../../../layout';
import { google } from 'googleapis';

export async function GET() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    const { data: emailAccounts, error: emailAccountsError } = await supabase
      .from('email_accounts')
      .select('id, email_address, access_token, refresh_token');

    if (emailAccountsError || !emailAccounts?.length) {
      return NextResponse.json({ error: emailAccountsError?.message || 'No accounts' }, { status: 500 });
    }

    for (const account of emailAccounts) {
      const { access_token, refresh_token, id: emailAccountId } = account;

      oauth2Client.setCredentials({ access_token, refresh_token });

      if (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date <= Date.now()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        await supabase.from('email_accounts').update({
          access_token: credentials.access_token,
        }).eq('id', emailAccountId);
      }

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const messagesResponse = await gmail.users.messages.list({ userId: 'me', maxResults: 5 });

      if (messagesResponse.data.messages) {
        for (const message of messagesResponse.data.messages) {
          const messageDetails = await gmail.users.messages.get({ userId: 'me', id: message.id! });
          const headers = messageDetails.data.payload?.headers || [];

          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const fromEmail = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const receivedAt = new Date(parseInt(messageDetails.data.internalDate || '0')).toISOString();

          // Check if the email already exists in the inquiries table
          const { data: existingEmail } = await supabase
            .from('inquiries')
            .select('id')
            .eq('email_account_id', emailAccountId)
            .eq('subject', subject)
            .eq('from_email', fromEmail)
            .eq('received_at', receivedAt)
            .single();

          if (!existingEmail) {
            // Save the email to the inquiries table if it doesn't already exist
            await supabase.from('inquiries').insert({
              email_account_id: emailAccountId,
              subject,
              from_email: fromEmail,
              received_at: receivedAt,
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to fetch emails' }, { status: 500 });
  }
}