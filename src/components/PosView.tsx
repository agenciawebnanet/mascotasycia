import React, { useMemo, useState } from 'react';
import { Banknote, CreditCard, Plus, QrCode, Receipt, Search, ShoppingBag, UserCheck, X } from 'lucide-react';
import type { AppLanguage, Comanda, Pet, Product, ServiceItem, Store, Tutor } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatCurrency, formatDateTime } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { downloadReceiptPdf } from '../lib/pdf';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  tutors: Tutor[];
  pets: Pet[];
  services: ServiceItem[];
  products: Product[];
  comandas: Comanda[];
  onRefresh: () => Promise<void>;
}

function paymentLabel(method: Comanda['payment_method']) {
  switch (method) {
    case 'pix':
      return 'Transferencia';
    case 'card':
      return 'Tarjeta';
    case 'cash':
      return 'Efectivo';
    case 'fiado':
      return 'Fiado';
    default:
      return '—';
  }
}

export function PosView({ ctx, store, lang, tutors, pets, services, products, comandas, onRefresh }: Props) {
  const t = getTranslations(lang);
  const openComandas = useMemo(() => comandas.filter((c) => c.status === 'open'), [comandas]);
  const closedComandas = useMemo(() => comandas.filter((c) => c.status !== 'open'), [comandas]);

  const [selectedId, setSelectedId] = useState<number | null>(openComandas[0]?.id ?? null);
  const activeComanda = useMemo(
    () => openComandas.find((c) => c.id === selectedId) || openComandas[0] || null,
    [openComandas, selectedId],
  );

  const [productQuery, setProductQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'cash' | 'fiado'>('pix');
  const [discount, setDiscount] = useState('0');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTutorId, setNewTutorId] = useState(String(tutors[0]?.id || ''));
  const [newPetId, setNewPetId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastPaidMsg, setLastPaidMsg] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter(
        (p) =>
          p.name_es.toLowerCase().includes(q) ||
          p.name_pt.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.sku.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, productQuery]);

  async function handleCreateComanda(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const created = await apiFetch<Comanda>('/api/comandas', ctx, {
        method: 'POST',
        body: JSON.stringify({
          tutor_id: Number(newTutorId),
          pet_id: newPetId ? Number(newPetId) : null,
        }),
      });
      setShowNewModal(false);
      await onRefresh();
      setSelectedId(created.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddItem(item_type: 'product' | 'service', ref_id: number) {
    if (!activeComanda) return;
    setError(null);
    try {
      await apiFetch(`/api/comandas/${activeComanda.id}/items`, ctx, {
        method: 'POST',
        body: JSON.stringify({ item_type, ref_id, qty: 1 }),
      });
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCheckout() {
    if (!activeComanda) return;
    setError(null);
    setLastPaidMsg(null);
    try {
      const paid = await apiFetch<Comanda>(`/api/comandas/${activeComanda.id}/checkout`, ctx, {
        method: 'POST',
        body: JSON.stringify({
          payment_method: paymentMethod,
          discount: Number(discount || 0),
        }),
      });
      setDiscount('0');
      setLastPaidMsg(
        lang === 'pt-BR'
          ? `Venda #${paid.id} fechada (${formatCurrency(paid.total, store.currency)}). Estoque atualizado automaticamente.`
          : `Venta #${paid.id} cerrada (${formatCurrency(paid.total, store.currency)}). Stock actualizado automáticamente.`,
      );
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.pos.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.pos.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.pos.newComanda}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {lastPaidMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center justify-between">
          <span>{lastPaidMsg}</span>
          <button type="button" onClick={() => setLastPaidMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Open Comandas Switcher */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-600">{t.pos.openComandas}:</span>
        {openComandas.length === 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : (
          openComandas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                activeComanda?.id === c.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              #{c.id} · {c.tutor_name} ({formatCurrency(c.total, store.currency)})
            </button>
          ))
        )}
      </div>

      {/* Main PDV Split */}
      {activeComanda ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Quick Catalog & Services */}
          <div className="lg:col-span-7 space-y-5">
            <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="text-sm font-bold text-slate-900">{t.pos.addProduct}</div>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={t.pos.barcodePlaceholder}
                  className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={p.stock_qty <= 0}
                    onClick={() => handleAddItem('product', p.id)}
                    className="text-left p-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 disabled:opacity-40 transition-colors"
                  >
                    <div className="text-xs font-semibold text-slate-900 line-clamp-1">
                      {lang === 'pt-BR' ? p.name_pt : p.name_es}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="font-mono-tabular font-bold text-teal-800">
                        {formatCurrency(p.price, store.currency)}
                      </span>
                      <span className="text-slate-500 font-mono-tabular">
                        {t.inventory.stock}: {p.stock_qty}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
              <div className="text-sm font-bold text-slate-900">{t.pos.addService}</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleAddItem('service', s.id)}
                    className="text-left p-3 rounded-xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 transition-colors"
                  >
                    <div className="text-xs font-semibold text-slate-900">
                      {lang === 'pt-BR' ? s.name_pt : s.name_es}
                    </div>
                    <div className="text-xs font-mono-tabular font-bold text-teal-800 mt-1">
                      {formatCurrency(s.price, store.currency)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Active Comanda & Checkout */}
          <div className="lg:col-span-5">
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 sticky top-20">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-teal-700" />
                    <span>Comanda #{activeComanda.id}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {activeComanda.tutor_name} {activeComanda.pet_name ? `· ${activeComanda.pet_name}` : ''}
                  </div>
                </div>
                <span className="hidden sm:block text-[10px] font-mono-tabular text-slate-400 text-right leading-tight max-w-[45%] shrink-0">
                  {store.fiscal_mode === 'BR_NFCE_NFSE' ? t.pos.fiscalDocBr : t.pos.fiscalDocPy}
                </span>
              </div>

              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {activeComanda.items.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    {lang === 'pt-BR' ? 'Comanda vazia. Adicione produtos ou serviços.' : 'Comanda vacía. Agregue productos o servicios.'}
                  </div>
                ) : (
                  activeComanda.items.map((it) => (
                    <div key={it.id} className="py-2.5 flex items-center justify-between gap-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900 truncate">{it.description}</div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          {it.qty} × {formatCurrency(it.unit_price, store.currency)}
                        </div>
                      </div>
                      <div className="font-mono-tabular font-semibold text-slate-900 shrink-0">
                        {formatCurrency(it.total_price, store.currency)}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totals */}
              <div className="pt-3 border-t border-slate-200 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>{t.pos.subtotal}</span>
                  <span className="font-mono-tabular">{formatCurrency(activeComanda.subtotal, store.currency)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>{t.pos.discount}</span>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-28 h-8 px-2 border border-slate-200 rounded-md text-right font-mono-tabular text-sm"
                  />
                </div>
                <div className="flex justify-between text-lg font-bold text-slate-900 pt-1">
                  <span>{t.pos.total}</span>
                  <span className="font-mono-tabular text-teal-800">
                    {formatCurrency(Math.max(0, activeComanda.subtotal - Number(discount || 0)), store.currency)}
                  </span>
                </div>
              </div>

              {/* Payment method selector */}
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['pix', t.pos.payPix, QrCode],
                    ['card', t.pos.payCard, CreditCard],
                    ['cash', t.pos.payCash, Banknote],
                    ['fiado', t.pos.payFiado, UserCheck],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPaymentMethod(key)}
                    className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 transition-colors ${
                      paymentMethod === key
                        ? 'border-teal-700 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{label}</span>
                  </button>
                ))}
              </div>

              {paymentMethod === 'pix' && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                  <svg viewBox="0 0 40 40" className="w-14 h-14 shrink-0 bg-white p-1 border border-slate-200 rounded-lg">
                    <rect x="2" y="2" width="12" height="12" fill="#0f172a" />
                    <rect x="5" y="5" width="6" height="6" fill="#ffffff" />
                    <rect x="26" y="2" width="12" height="12" fill="#0f172a" />
                    <rect x="29" y="5" width="6" height="6" fill="#ffffff" />
                    <rect x="2" y="26" width="12" height="12" fill="#0f172a" />
                    <rect x="5" y="29" width="6" height="6" fill="#ffffff" />
                    <rect x="18" y="18" width="6" height="6" fill="#0f766e" />
                    <rect x="28" y="22" width="4" height="4" fill="#0f172a" />
                    <rect x="20" y="30" width="8" height="4" fill="#0f172a" />
                  </svg>
                  <div className="text-xs text-slate-600">{t.pos.pixQrHint}</div>
                </div>
              )}

              <button
                type="button"
                disabled={activeComanda.items.length === 0}
                onClick={handleCheckout}
                className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
              >
                {t.pos.closeSale}
              </button>
            </section>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
          <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600">
            {lang === 'pt-BR' ? 'Nenhuma comanda aberta no momento.' : 'No hay comandas abiertas en este momento.'}
          </p>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-medium"
          >
            {t.pos.newComanda}
          </button>
        </div>
      )}

      {/* Closed Sales History */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 font-semibold text-sm text-slate-900">
          {t.pos.closedSales}
        </div>
        <div className="divide-y divide-slate-100">
          {closedComandas.map((c) => (
            <div key={c.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">
                  Comanda #{c.id} · {c.tutor_name}
                </div>
                <div className="text-xs text-slate-500">
                  {formatDateTime(c.paid_at || c.created_at, lang)} · {paymentLabel(c.payment_method)} · {c.fiscal_ref}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="font-mono-tabular font-bold text-slate-900">{formatCurrency(c.total, store.currency)}</div>
                <button
                  type="button"
                  onClick={() => downloadReceiptPdf(c, store, lang, ctx.mode)}
                  className="min-h-[34px] px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                  title="Descargar comprobante"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Recibo
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modal: New Comanda */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreateComanda} className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.pos.newComanda}</h3>
              <button type="button" onClick={() => setShowNewModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tutor *</label>
              <select
                value={newTutorId}
                onChange={(e) => setNewTutorId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {tutors.map((tu) => (
                  <option key={tu.id} value={tu.id}>
                    {tu.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pet (opcional)</label>
              <select
                value={newPetId}
                onChange={(e) => setNewPetId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="">—</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 text-sm"
              >
                {t.patients.cancel}
              </button>
              <button type="submit" className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium">
                {t.patients.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
