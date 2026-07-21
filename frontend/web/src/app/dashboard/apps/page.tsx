'use client';

import Link from 'next/link';
import { Mail, KeyRound, Images } from 'lucide-react';

const mailUrl = process.env.NEXT_PUBLIC_MAIL_URL || '';
const vaultUrl = process.env.NEXT_PUBLIC_VAULT_URL || '';
const photosUrl = process.env.NEXT_PUBLIC_PHOTOS_URL || '';

const apps = [
  {
    id: 'mail',
    name: 'PrivMail',
    description: 'E-Mail, Kalender und Kontakte',
    href: mailUrl || '/dashboard/inbox',
    icon: Mail,
    external: Boolean(mailUrl),
    configured: true,
  },
  {
    id: 'vault',
    name: 'Passwort-Tresor',
    description: 'Vaultwarden (Bitwarden-kompatibel)',
    href: vaultUrl,
    icon: KeyRound,
    external: true,
    configured: Boolean(vaultUrl),
  },
  {
    id: 'photos',
    name: 'Fotos',
    description: 'Immich Foto- & Video-Bibliothek',
    href: photosUrl,
    icon: Images,
    external: true,
    configured: Boolean(photosUrl),
  },
];

export default function AppsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Apps</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ein PrivMail-Konto meldet dich per SSO auch bei Tresor und Fotos an.
          Die Ziel-URLs kommen aus der Konfiguration deiner Instanz (Setup-Wizard).
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-3">
        {apps.map((app) => {
          const Icon = app.icon;
          const className =
            'flex flex-col items-start gap-3 rounded-[var(--radius)] border border-border bg-background p-5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
          const content = (
            <>
              <Icon size={28} className="text-foreground" aria-hidden />
              <div>
                <p className="font-medium">{app.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
                {!app.configured && (
                  <p className="mt-2 text-xs text-amber-700">
                    Noch nicht konfiguriert — Setup-Wizard auf dem Server ausführen.
                  </p>
                )}
              </div>
            </>
          );
          return (
            <li key={app.id}>
              {app.configured && app.external ? (
                <a href={app.href} className={className} rel="noopener noreferrer">
                  {content}
                </a>
              ) : app.configured ? (
                <Link href={app.href} className={className}>
                  {content}
                </Link>
              ) : (
                <div className={`${className} opacity-70`}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        Hinweis: Beim Passwort-Tresor bleibt das Vaultwarden-Master-Passwort zusätzlich zum SSO
        erforderlich — es leitet den Verschlüsselungsschlüssel des Tresors ab.
      </p>
    </div>
  );
}
