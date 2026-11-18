import React from 'react';

/**
 * Marca de Mascotas y Cia: huella sobre un cuadrado redondeado con degradado.
 * SVG inline para que se vea nítida en cualquier tamaño y no dependa de assets.
 */
export function BrandMark({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Mascotas y Cia">
      <defs>
        <linearGradient id="mc-brand-gradient" x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0d9488" />
          <stop offset="55%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#134e4a" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#mc-brand-gradient)" />
      <circle cx="38" cy="10" r="4.5" fill="#fbbf24" opacity="0.95" />
      <g fill="#ffffff">
        <ellipse cx="24" cy="30" rx="8.6" ry="7.3" />
        <ellipse cx="13.9" cy="21" rx="3.4" ry="4.2" transform="rotate(-18 13.9 21)" />
        <ellipse cx="20.5" cy="15.8" rx="3.3" ry="4.3" transform="rotate(-7 20.5 15.8)" />
        <ellipse cx="27.6" cy="15.8" rx="3.3" ry="4.3" transform="rotate(7 27.6 15.8)" />
        <ellipse cx="34" cy="21" rx="3.4" ry="4.2" transform="rotate(18 34 21)" />
      </g>
    </svg>
  );
}
