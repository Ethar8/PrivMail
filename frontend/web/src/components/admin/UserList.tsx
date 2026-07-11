'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Trash2 } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
}

export function UserList() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api
      .get<{ users: AdminUser[] }>('/admin/users')
      .then((res) => setUsers(res.users))
      .catch((err) => setError((err as Error).message));
  };

  useEffect(load, []);

  const remove = async (id: string) => {
    await api.del(`/admin/users/${id}`);
    load();
  };

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-2">E-Mail</th>
          <th className="py-2">Name</th>
          <th className="py-2">Admin</th>
          <th className="py-2"></th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b border-border">
            <td className="py-2">{u.email}</td>
            <td className="py-2">{u.displayName ?? '—'}</td>
            <td className="py-2">{u.isAdmin ? 'Ja' : 'Nein'}</td>
            <td className="py-2 text-right">
              <Button variant="ghost" size="icon" onClick={() => remove(u.id)} aria-label="Löschen">
                <Trash2 size={16} />
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
