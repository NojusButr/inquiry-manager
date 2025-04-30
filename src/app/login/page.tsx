"use client";

import { useState } from 'react';
import { supabase } from '../layout';
import { useRouter } from 'next/navigation';

export default function LogIn() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogIn = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if identifier is an email or name
    const isEmail = identifier.includes('@');

    let user;
    if (isEmail) {
      user = await supabase.auth.signInWithPassword({ email: identifier, password });
    } else {
      const { data, error: fetchError } = await supabase
        .from('Users')
        .select('email')
        .eq('name', identifier)
        .single();

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      user = await supabase.auth.signInWithPassword({ email: data.email, password });
    }

    if (user.error) {
      setError(user.error.message);
    } else {
      alert('Log-in successful!');
      setTimeout(() => {
        router.push('/inbox');
      }, 500);
    }
  };

  return (
    <div>
      <h1>Log In</h1>
      <form onSubmit={handleLogIn}>
        <input
          type="text"
          placeholder="Email or Name"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Log In</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}