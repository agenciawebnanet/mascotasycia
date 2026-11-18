import type { AppLanguage, CurrencyCode } from './types';

export function roundCurrency(amount: number, currency: CurrencyCode): number {
  if (currency === 'PYG') {
    return Math.round(amount);
  }
  return Math.round(amount * 100) / 100;
}

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  const rounded = roundCurrency(amount, currency);
  if (currency === 'PYG') {
    const formatted = Math.abs(rounded)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return rounded < 0 ? `-G$ ${formatted}` : `G$ ${formatted}`;
  }
  if (currency === 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(rounded);
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rounded);
}

export function formatDateShort(isoDate: string | null | undefined, lang: AppLanguage): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-PY' : 'pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(isoDate: string | null | undefined, lang: AppLanguage): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-PY' : 'pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatTimeOnly(isoDate: string | null | undefined, lang: AppLanguage): string {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat(lang === 'es' ? 'es-PY' : 'pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
