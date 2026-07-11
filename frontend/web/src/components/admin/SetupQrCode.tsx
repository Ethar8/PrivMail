'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildAutodiscoveryPayload, AutodiscoveryParams } from '@/lib/autodiscovery';
import { Smartphone, Copy, Check } from 'lucide-react';

/**
 * Renders an RFC 6186 auto-discovery QR code for a newly created user so a
 * mobile device can configure the account (JMAP/WebDAV + SMTP/IMAP) by simply
 * scanning it — no manual port entry.
 */
export function SetupQrCode(params: AutodiscoveryParams) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const payload = buildAutodiscoveryPayload(params);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/30 p-6 text-center">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Smartphone size={16} className="text-primary" />
        Mobil einrichten (Auto-Discovery)
      </div>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="Setup QR-Code" width={240} height={240} className="rounded-lg bg-white p-2" />
      ) : (
        <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-muted-foreground">
          QR wird erzeugt…
        </div>
      )}
      <p className="max-w-xs text-xs text-muted-foreground">
        Scanne den Code mit der PrivMail-App, um {params.email} automatisch einzurichten – ohne
        Ports oder Server manuell einzugeben.
      </p>
      <button
        onClick={copy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted"
      >
        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        {copied ? 'Kopiert' : 'Konfiguration kopieren'}
      </button>
    </div>
  );
}
