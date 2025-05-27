"use client";
import { useState, useEffect } from 'react';
import { supabase } from '../layout';

interface TeamUser {
  id: string;
  email: string;
  role: string;
  company_id: string;
}

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState<{ id: string; email: string; role: string }[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('agent');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<TeamUser | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserAndTeam = async () => {
      setLoading(true);
      // Get current auth user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('Not logged in');
        setLoading(false);
        return;
      }
      // Get custom user (with role and company_id)
      const { data: customUser } = await supabase
        .from('users')
        .select('id, email, role, company_id')
        .eq('auth_id', authUser.id)
        .single();
      if (!customUser) {
        setError('User not found');
        setLoading(false);
        return;
      }
      setUser(customUser);
      setCompanyId(customUser.company_id);
      if (customUser.role !== 'admin') {
        setLoading(false);
        return;
      }
      // Fetch all users for this company
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('company_id', customUser.company_id);
      if (usersError) setError(usersError.message);
      else setTeamMembers(usersData || []);
      setLoading(false);
    };
    fetchUserAndTeam();
  }, []);

  const handleAddMember = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    if (!companyId) return;
    // Insert new user (invite pattern: just add to users table, real invite flow can be added later)
    const { error } = await supabase.from('users').insert({ email, name, role, company_id: companyId });
    if (error) setError(error.message);
    else {
      setEmail('');
      setName('');
      setRole('agent');
      // Refresh team list
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('company_id', companyId);
      setTeamMembers(usersData || []);
      // Show invite link for manual copy
      setInviteLink(`${window.location.origin}/signup?email=${encodeURIComponent(email)}&company_id=${companyId}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    await supabase.from('users').update({ role: newRole }).eq('id', userId);
    setTeamMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role: newRole } : m));
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this user?')) return;
    await supabase.from('users').delete().eq('id', userId);
    setTeamMembers((prev) => prev.filter((m) => m.id !== userId));
  };

  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <div className="p-8 text-center text-red-600 font-bold">Access denied. Admins only.</div>;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Team Management</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleAddMember} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="border rounded px-2 py-1 flex-1"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border rounded px-2 py-1 flex-1"
        />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-2 py-1">
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
        </select>
        <button type="submit" className="bg-blue-600 text-white px-4 py-1 rounded">Add Member</button>
      </form>
      {inviteLink && (
        <div className="mt-2 p-2 bg-green-100 border border-green-400 rounded">
          Invite link: <a href={inviteLink} className="text-blue-600 underline">{inviteLink}</a><br />
          Copy and send this link to the invited user.
        </div>
      )}
      <ul className="divide-y">
        {teamMembers.map((member) => (
          <li key={member.id} className="flex items-center justify-between py-2">
            <span>{member.email} - </span>
            <select
              value={member.role}
              onChange={e => handleRoleChange(member.id, e.target.value)}
              className="border rounded px-2 py-1 mx-2"
            >
              <option value="admin">Admin</option>
              <option value="agent">Agent</option>
            </select>
            <button
              className="bg-red-500 text-white px-2 py-1 rounded"
              onClick={() => handleDelete(member.id)}
              disabled={member.id === user.id}
              title={member.id === user.id ? 'You cannot remove yourself' : 'Remove user'}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}