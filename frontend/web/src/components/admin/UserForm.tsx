'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface UserFormData {
  email: string;
  password: string;
  displayName: string;
  isAdmin: boolean;
}

interface UserFormProps {
  onSubmit: (data: UserFormData) => void;
}

export function UserForm({ onSubmit }: UserFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email, password, displayName, isAdmin });
    setEmail('');
    setPassword('');
    setDisplayName('');
    setIsAdmin(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium">E-Mail</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Passwort</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Name</label>
        <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Administrator</label>
        <Switch checked={isAdmin} onCheckedChange={setIsAdmin} />
      </div>
      <div>
        <Button type="submit">Benutzer erstellen</Button>
      </div>
    </form>
  );
}
