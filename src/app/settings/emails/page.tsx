'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../layout';

export default function EmailSettings() {
  const [emailAccounts, setEmailAccounts] = useState<{ id: string; email_address: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmailAccounts = async () => {
      // Step 1: Get the currently authenticated user from Supabase auth
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError('Not logged in');
        setLoading(false);
        return;
      }

      // Step 2: Get the custom user data from your 'users' table using the Supabase auth user id
      const { data: customUser, error: userError } = await supabase
        .from('users')
        .select('id, email') // Adjust this query if you need more fields
        .eq('auth_id', user.id) // Link to the Supabase auth user
        .single(); // Use .single() to ensure you only get one user, as 'auth_id' should be unique

      if (userError || !customUser) {
        setError('User not found');
        setLoading(false);
        return;
      }

      // Step 3: Fetch the email accounts for the custom user from 'email_accounts' table
      const { data, error } = await supabase
        .from('email_accounts')
        .select('*')
        .eq('user_id', customUser.id); // Use the 'user_id' from your 'users' table

      if (error) {
        setError(error.message);
      } else {
        setEmailAccounts(data); // Successfully retrieved email accounts
      }

      setLoading(false);
    };

    fetchEmailAccounts();
  }, []);

  const handleAddAccount = async () => {
    window.location.href = '/api/auth/gmail'; // Redirects to the Gmail OAuth flow
  };

  return (
    <div>
      <h1>Email Settings</h1>
      <button onClick={handleAddAccount}>Add Gmail Account</button>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul>
        {emailAccounts.map((account) => (
          <li key={account.id}>{account.email_address}</li> // Display the email address of each connected account
        ))}
      </ul>
    </div>
  );
}
