import React, { useState } from 'react';
import { PawPrint } from 'lucide-react';
import type { Store } from '../shared/types';
import { BrandMark } from './BrandMark';

export function ClinicLogo({ store, size = 'md' }: { store: Store; size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  if (store.logo_url) {
    return (
      <img
        src={store.logo_url}
        alt={store.name}
        referrerPolicy="no-referrer"
        className={`${dims} rounded-xl object-cover border border-slate-200 shrink-0 bg-white`}
      />
    );
  }
  if (/mascotas/i.test(store.name)) {
    return <BrandMark className={`${dims} shrink-0`} />;
  }
  const initials =
    store.name
      .split(/\s+/)
      .filter((w) => w.length > 0 && w !== '&' && w !== '—')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('') || 'MC';

  return (
    <div
      style={{ backgroundColor: store.accent_color || '#0f766e' }}
      className={`${dims} rounded-xl text-white font-display font-bold flex items-center justify-center shrink-0 tracking-tight`}
    >
      {initials}
    </div>
  );
}

export function PetPhoto({
  src,
  name,
  className = 'w-12 h-12 rounded-xl',
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-teal-50 border border-teal-200/80 text-teal-700 flex items-center justify-center shrink-0`}
        aria-label={name}
      >
        <PawPrint className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover border border-slate-200 shrink-0 bg-slate-100`}
    />
  );
}
