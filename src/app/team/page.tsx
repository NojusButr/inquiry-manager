import { useState, useEffect } from 'react';
import { supabase } from '../layout';

export default function TeamManagement() {
  const [teamMembers, setTeamMembers] = useState<{ id: number; email: string; role: string }[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTeamMembers = async () => {
      const { data, error } = await supabase.from('users').select('*');
      if (error) setError(error.message);
      else setTeamMembers(data);
    };

    fetchTeamMembers();
  }, []);


const handleAddMember = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const { error } = await supabase.from('users').insert<{ email: string; role: string }>({ email, role });
    if (error) setError(error.message);
    else {
        setEmail('');
        setRole('agent');
        alert('Team member added successfully!');
    }
};

  return (
    <div>
      <h1>Team Management</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleAddMember}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
        </select>
        <button type="submit">Add Member</button>
      </form>
      <ul>
        {teamMembers.map((member) => (
          <li key={member.id}>
            {member.email} - {member.role}
          </li>
        ))}
      </ul>
    </div>
  );
}