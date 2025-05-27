import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { categorizeInquiry } from '../../categorize/route';
import { createClient } from '@/utils/supabase/server';


interface GmailPart {
  mimeType: string;
  body: {
    data: string;
  };
  parts?: GmailPart[];  // Nested parts in case of multipart/alternative
}

export async function GET(request: Request) {
  try {
    // Read fetch limit from custom header if present
    let fetchLimit: number | undefined = 5;
    if (request && 'headers' in request) {
      const headerLimit = request.headers.get('X-Gmail-Fetch-Limit');
      if (headerLimit === 'infinity') fetchLimit = undefined;
      else if (headerLimit && !isNaN(Number(headerLimit))) {
        const parsed = parseInt(headerLimit, 10);
        if (!isNaN(parsed) && parsed > 0) fetchLimit = parsed;
      }
    }
    // Fallback to env if not set
    if (typeof fetchLimit === 'undefined' && process.env.GMAIL_FETCH_LIMIT) {
      if (process.env.GMAIL_FETCH_LIMIT === 'infinity') fetchLimit = undefined;
      else {
        const parsed = parseInt(process.env.GMAIL_FETCH_LIMIT, 10);
        if (!isNaN(parsed) && parsed > 0) fetchLimit = parsed;
      }
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
    );

    // Use the server-side Supabase client
    const supabase = await createClient();

    const { data: emailAccounts, error: emailAccountsError } = await supabase
      .from('email_accounts')
      .select('id, email_address, access_token, refresh_token');

    if (emailAccountsError || !emailAccounts?.length) {
      return NextResponse.json({ error: emailAccountsError?.message || 'No accounts' }, { status: 500 });
    }

    for (const account of emailAccounts) {
      const { access_token, refresh_token, id: emailAccountId } = account;

      oauth2Client.setCredentials({ access_token, refresh_token });

      // Refresh token if expired
      if (oauth2Client.credentials.expiry_date && oauth2Client.credentials.expiry_date <= Date.now()) {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        await supabase
          .from('email_accounts')
          .update({ access_token: credentials.access_token })
          .eq('id', emailAccountId);
      }

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      const messagesResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: fetchLimit,
      });

      if (messagesResponse.data.messages) {
        for (const message of messagesResponse.data.messages) {
          const messageDetails = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full', // full gives access to payload and body
          });

          const headers = messageDetails.data.payload?.headers || [];

          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const fromEmail = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const receivedAt = new Date(parseInt(messageDetails.data.internalDate || '0')).toISOString();
          const threadId = messageDetails.data.threadId || null;
          const originalId = messageDetails.data.id || null;

          // Extract body text (prefer HTML if available)
          let body = '';
          
          // Helper function to extract body from GmailParts
          const getBodyFromParts = (parts: GmailPart[]): string => {
            for (const part of parts) {
              if (part.mimeType === 'text/html') {
                return Buffer.from(part.body.data || '', 'base64').toString('utf-8');
              } else if (part.mimeType === 'multipart/alternative') {
                return getBodyFromParts(part.parts || []);
              }
            }

            const plainPart = parts.find(p => p.mimeType === 'text/plain');
            return plainPart
              ? Buffer.from(plainPart.body.data || '', 'base64').toString('utf-8')
              : '';
          };

          const payload = messageDetails.data.payload;

          if (payload?.parts?.length) {
            body = getBodyFromParts(payload.parts as GmailPart[]); // Type casting here to ensure parts is correctly typed
          } else if (payload?.mimeType === 'text/html' && payload?.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          } else if (payload?.body?.data) {
            body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          }

          // Get read/unread status from Gmail API
          const labelIds = messageDetails.data.labelIds || [];
          const isRead = !labelIds.includes('UNREAD');

          // Check if already exists in database to avoid duplicates
          const { data: existingEmail } = await supabase
            .from('inquiries')
            .select('id')
            .eq('email_account_id', emailAccountId)
            .eq('subject', subject)
            .eq('from_email', fromEmail)
            .eq('received_at', receivedAt)
            .single();

          // Only categorize if not already categorized (i.e., if not already in inquiry_categories)
          if (!existingEmail) {
            const { data: inserted, error: insertError } = await supabase.from('inquiries').insert({
              email_account_id: emailAccountId,
              subject,
              from_email: fromEmail,
              received_at: receivedAt,
              thread_id: threadId,
              original_id: originalId,
              body,
              is_read: isRead,
              // other fields like channel, status will use default values
            }).select('id').single();
            if (insertError) {
              console.error('Failed to insert inquiry:', insertError);
            }
            if (inserted && inserted.id) {
              // Only categorize if not already categorized
              const { data: catExists } = await supabase
                .from('inquiry_categories')
                .select('id')
                .eq('inquiry_id', inserted.id)
                .limit(1)
                .single();
              if (!catExists) {
                console.log('Inserted new inquiry, categorizing:', inserted.id);
                await categorizeInquiry(inserted.id);
              } else {
                console.log('Inserted new inquiry, already categorized:', inserted.id);
              }
            }
          } else {
            // Update is_read status for existing inquiry
            await supabase.from('inquiries').update({ is_read: isRead }).eq('id', existingEmail.id);
            // Do NOT categorize again if already in supabase
            console.log('Existing inquiry, skipping categorization:', existingEmail.id);
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
