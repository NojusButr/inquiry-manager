"use client";

import { useState, useEffect } from 'react';
import { supabase } from '../layout';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // If invite, these will be present
  const invitedEmail = searchParams.get('email');
  const invitedCompanyId = searchParams.get('company_id');

  useEffect(() => {
    if (invitedEmail) setEmail(''); // Let user input their own email
  }, [invitedEmail]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If invite link (email+company_id in query)
    if (invitedEmail && invitedCompanyId) {
      // 1. Check if invited and not already registered
      const { data: invitedUser } = await supabase
        .from('users')
        .select('id, auth_id')
        .eq('company_id', invitedCompanyId)
        .eq('email', invitedEmail)
        .single();
      if (!invitedUser) {
        setError('You must be invited by your company admin.');
        return;
      }
      if (invitedUser.auth_id) {
        setError('This invite has already been used. Please log in.');
        return;
      }
      // 2. Proceed with Supabase Auth signup
      const { data: authUser, error: signUpError } = await supabase.auth.signUp({ email: invitedEmail, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      if (!authUser.user) {
        setError('Signup successful. Please check your email to confirm your account, then log in.');
        return;
      }
      // 3. Update users table with auth_id and email
      await supabase
        .from('users')
        .update({ auth_id: authUser.user.id, email: invitedEmail })
        .eq('id', invitedUser.id);
      router.push('/inbox');
      return;
    }

    // Company admin self-signup (no invite)
    if (!companyName || !industry || !country) {
      setError('Please fill in all company details.');
      return;
    }
    try {
      // 1. Check if company exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('name', companyName)
        .single();
      let companyIdToUse = existingCompany?.id;
      if (!companyIdToUse) {
        // 2. Create company if not exists
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .insert({ name: companyName, industry, country })
          .select()
          .single();
        if (companyError) throw new Error(companyError.message || 'Failed to create company.');
        companyIdToUse = company.id;
      }
      // 3. Check if user already exists for this company
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .eq('company_id', companyIdToUse)
        .single();
      if (existingUser) {
        setError('A user with this email already exists for this company. Please log in or use a different email.');
        return;
      }
      // 4. Create auth user
      const { data: authUser, error: userError } = await supabase.auth.signUp({ email, password });
      if (userError) throw new Error(userError.message || 'Failed to create auth user.');
      // 5. Insert user row as admin
      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          email,
          name: email.split('@')[0],
          company_id: companyIdToUse,
          role: 'admin',
          auth_id: authUser.user?.id,
        });
      if (userInsertError) throw new Error(userInsertError.message || 'Failed to insert user.');
      router.push('/inbox');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  return (
    <div>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignUp}>
        {/* If invite, show only password field, else show full company admin form */}
        {invitedEmail && invitedCompanyId ? (
          <>
            <input
              type="email"
              placeholder="Your Email"
              value={invitedEmail}
              readOnly
              className="border rounded px-2 py-1 mb-2 bg-gray-100 cursor-not-allowed"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border rounded px-2 py-1 mb-2"
            />
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              className="border rounded px-2 py-1 mb-2"
            />
            <input
              type="text"
              placeholder="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
              className="border rounded px-2 py-1 mb-2"
            />
            <input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
              className="border rounded px-2 py-1 mb-2"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border rounded px-2 py-1 mb-2"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border rounded px-2 py-1 mb-2"
            />
          </>
        )}
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Sign Up</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}