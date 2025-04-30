"use client";

import { useState } from 'react';
import { supabase } from '../layout';
import { useRouter } from 'next/navigation';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Sign-up process started');

    try {
      // Start a transaction
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({ name: companyName, industry, country })
        .select()
        .single();

      if (companyError) {
        throw new Error(companyError.message || 'Failed to create company.');
      }

      console.log('Company created:', company);

      const { data: authUser, error: userError } = await supabase.auth.signUp({ email, password });

      if (userError) {
        throw new Error(userError.message || 'Failed to create auth user.');
      }

      console.log('Auth user created:', authUser);

      const { error: userInsertError } = await supabase
        .from('users')
        .insert({
          email,
          name: email.split('@')[0], // Default name from email
          company_id: company.id,
          role: 'admin',
          auth_id: authUser.user?.id, // Use the Supabase auth user ID
        });

      if (userInsertError) {
        throw new Error(userInsertError.message || 'Failed to insert user.');
      }

      console.log('User inserted successfully');
      alert('Sign-up successful! Redirecting to login.');
      router.push('/login'); // Redirect to login after successful signup
    } catch (err) {
      console.error('Sign-up error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unknown error occurred.');
      }

      // Rollback logic: Delete the company if it was created but user creation failed
      if (companyName) {
        await supabase.from('companies').delete().eq('name', companyName);
        console.log('Rolled back company creation.');
      }
    }
  };

  return (
    <div>
      <h1>Sign Up</h1>
      <form onSubmit={handleSignUp}>
        <input
          type="text"
          placeholder="Company Name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Industry"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Sign Up</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}