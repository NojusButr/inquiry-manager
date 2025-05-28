'use client';

import { useEffect, useState } from 'react';
//import { supabase } from '../../layout';
import { X } from 'lucide-react';
import Image from 'next/image';
import { supabase } from "../../layout";

export default function EmailSettings() {
  const [emailAccounts, setEmailAccounts] = useState<{ id: string; email_address: string; user_id: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteFromGmail, setDeleteFromGmail] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('deleteFromGmail');
      return stored === 'true';
    }
    return false;
  });
  // Add fetch limit state
  const [fetchLimit, setFetchLimit] = useState<number | 'infinity'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('gmailFetchLimit');
      if (stored === 'infinity') return 'infinity';
      const num = Number(stored);
      return isNaN(num) ? 5 : num;
    }
    return 5;
  });
  const [isAdmin, setIsAdmin] = useState(false);
  // Removed unused companyId state
  const [userMap, setUserMap] = useState<Record<string, string>>({});

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
        .select('id, email, company_id, role') // Add company_id and role
        .eq('auth_id', user.id)
        .single();

      if (userError || !customUser) {
        setError('User not found');
        setLoading(false);
        return;
      }

      setIsAdmin(customUser.role === 'admin');

      type EmailAccount = { id: string; email_address: string; user_id: string };
      let emailAccountsData: EmailAccount[] = [];
      if (customUser.role === 'admin' && customUser.company_id) {
        // Admin: fetch all email accounts for the company
        const { data, error } = await supabase
          .from('email_accounts')
          .select('id, email_address, user_id')
          .eq('company_id', customUser.company_id);
        if (error) {
          setError(error.message);
        } else {
          emailAccountsData = Array.isArray(data) ? data : [];
        }
      } else {
        // Regular user: fetch only their own email accounts
        const { data, error } = await supabase
          .from('email_accounts')
          .select('id, email_address, user_id')
          .eq('user_id', customUser.id);
        if (error) {
          setError(error.message);
        } else {
          emailAccountsData = Array.isArray(data) ? data : [];
        }
      }
      setEmailAccounts(emailAccountsData);
      // If admin, fetch user names for display
      if (customUser.role === 'admin' && customUser.company_id && emailAccountsData.length > 0) {
        const userIds = Array.from(new Set(emailAccountsData.map(a => a.user_id).filter(Boolean)));
        if (userIds.length > 0) {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email')
            .in('id', userIds);
          if (!usersError && Array.isArray(users)) {
            const map: Record<string, string> = {};
            users.forEach(u => {
              map[u.id] = u.name || u.email || u.id;
            });
            setUserMap(map);
          }
        }
      }
      setLoading(false);
    };
    fetchEmailAccounts();
  }, []);

  const handleAddAccount = async () => {
    window.location.href = '/api/auth/gmail'; // Redirects to the Gmail OAuth flow
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to remove this Gmail account? This will also remove all associated inquiries and their tags.')) return;
    setLoading(true);
    setError(null);
    // 1. Fetch all inquiries for this account
    const { data: inquiries, error: fetchError } = await supabase
      .from('inquiries')
      .select('id')
      .eq('email_account_id', accountId);
    if (fetchError) {
      setError('Failed to fetch inquiries: ' + fetchError.message);
      setLoading(false);
      return;
    }
    const inquiryIds = (inquiries || []).map((inq) => inq.id);
    // 2. Delete inquiry_categories and inquiry_countries for these inquiries
    if (inquiryIds.length > 0) {
      await supabase.from('inquiry_categories').delete().in('inquiry_id', inquiryIds);
      await supabase.from('inquiry_countries').delete().in('inquiry_id', inquiryIds);
      // 3. Delete the inquiries themselves
      await supabase.from('inquiries').delete().in('id', inquiryIds);
    }
    // 4. Delete the email account
    const { error } = await supabase.from('email_accounts').delete().eq('id', accountId);
    if (error) {
      setError('Failed to remove account: ' + error.message);
    } else {
      setEmailAccounts((prev) => prev.filter((a) => a.id !== accountId));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('deleteFromGmail', deleteFromGmail ? 'true' : 'false');
    }
  }, [deleteFromGmail]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gmailFetchLimit', fetchLimit === 'infinity' ? 'infinity' : String(fetchLimit));
    }
  }, [fetchLimit]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Channels & Integrations</h1>
      <div>
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
              <Image src="/gmail.svg" alt="Gmail" width={24} height={24} className="w-6 h-6" />
              <span className="text-lg font-semibold">Gmail</span>
              <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">
                {emailAccounts.length} account{emailAccounts.length === 1 ? '' : 's'} connected
              </span>
            </div>
            <button
              onClick={handleAddAccount}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium shadow"
              disabled={loading}
            >
              + Add Gmail Account
            </button>
          </div>
          <ul className="divide-y border rounded bg-white mt-2">
            {emailAccounts.length === 0 && (
              <li className="p-4 text-gray-400 text-sm">No Gmail accounts connected.</li>
            )}
            {emailAccounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between px-4 py-3 group hover:bg-gray-50 transition">
                <span className="text-gray-800 font-medium">{account.email_address}</span>
                {isAdmin && userMap[account.user_id] && (
                  <span className="ml-2 text-xs text-gray-500">Added by: {userMap[account.user_id]}</span>
                )}
                <button
                  className="ml-2 p-1 rounded hover:bg-red-100 text-red-600 hover:text-red-800 transition flex items-center"
                  onClick={() => handleRemoveAccount(account.id)}
                  aria-label="Remove account"
                  disabled={loading}
                >
                  <X className="w-4 h-4" />
                  <span className="sr-only">Remove</span>
                </button>
              </li>
            ))}
          </ul>
        <div className="mb-8">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={deleteFromGmail}
              onChange={() => setDeleteFromGmail((prev) => !prev)}
            />
            <span className="font-medium">Also delete from Gmail when deleting an inquiry</span>
          </label>
          <p className="text-xs text-muted-foreground mt-1">
            If enabled, deleting an inquiry will also delete the original email from your Gmail account (if possible).
          </p>
        </div>
        <div className="mb-8">
          <label className="block font-medium mb-1">Number of emails to fetch per account</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              className="border rounded px-2 py-1 w-24"
              value={fetchLimit === 'infinity' ? '' : fetchLimit}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || isNaN(Number(val))) setFetchLimit('infinity');
                else setFetchLimit(Math.max(1, Number(val)));
              }}
              placeholder="5"
              disabled={fetchLimit === 'infinity'}
            />
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={fetchLimit === 'infinity'}
                onChange={e => setFetchLimit(e.target.checked ? 'infinity' : 5)}
              />
              <span>Fetch all (no limit)</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Controls how many emails are fetched per account during sync. Default is 5. Set to &quot;Fetch all&quot; for no limit (may be slow for large inboxes).
          </p>
        </div>
        {error && <div className="mb-4 text-red-600 font-medium">{error}</div>}
        {/* <Link href="/inbox" className="text-blue-600 hover:underline">Back to Inbox</Link> */}
      </div>
    </div>
  );
}
