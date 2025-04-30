// TODO: Add checking if email is unique in the database before inserting it into the `email_accounts` table
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@/utils/supabase/server';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code not found' }, { status: 400 });
  }

  // Initialize Supabase client first
  const supabase = await createClient(); // ✅ Await the supabase client
  
  try {
    // Step 1: Use the code to obtain Google tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Step 2: Get the user info from Google (email, etc.)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    const email = userInfo.email;
    if (!email) throw new Error('Email not found in user info');

    // Step 3: Retrieve the user’s information from Supabase using their email (assuming you already have a unique email per user)
    const { data: customUser, error: customUserError } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email)  // Link the Gmail account to the user by email
      .single();

    if (customUserError || !customUser) {
      console.error("Error fetching user:", customUserError || 'User not found');
      return NextResponse.json({ error: 'User not found or error fetching user data' }, { status: 500 });
    }

    // Step 4: Insert the Gmail account information into the `email_accounts` table
    const { error } = await supabase.from('email_accounts').insert({
      email_address: email,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      provider: 'gmail',
      connected_at: new Date().toISOString(),
      user_id: customUser.id,  // Link the email account to the user in the `users` table
    });

    if (error) {
      console.error('Error inserting email account:', error);
      throw new Error(error.message);
    }

    // Step 5: Redirect the user to the settings page
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/settings/emails`);
  } catch (err) {
    console.error('Error during Gmail callback:', err);
    return NextResponse.json({ error: 'Failed to complete Gmail connection', details: err }, { status: 500 });
  }
}
