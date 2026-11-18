import React, { useState } from 'react';
import { ArrowRight, Car, MessageCircle, Package, Plus, Receipt, X } from 'lucide-react';
import type { AppLanguage, GroomingOrder, Pet, PetPackage, ServiceItem, Store } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { buildWhatsAppLink, formatCurrency } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { PetPhoto } from './ClinicLogo';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  pets: Pet[];
  services: ServiceItem[];
  packages: PetPackage[];
  orders: GroomingOrder[];
  onRefresh: () => Promise<void>;
  onGoToPos: () => void;
}

const COLUMNS: Array<GroomingOrder['status']> = ['scheduled', 'in_progress', 'ready', 'delivered'];

export function GroomingView({ ctx, store, lang, pets, services, packages, orders, onRefresh, onGoToPos }: Props) {
  const t = getTranslations(lang);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groomingServices = services.filter((s) => s.category === 'grooming');
  const [form, setForm] = useState({
    pet_id: String(pets[0]?.id || ''),
    service_id: String(groomingServices[0]?.id || services[0]?.id || ''),
    taxi_dog: false,
    taxi_fee: '35000',
    package_id: '',
    notes: '',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pet = pets.find((p) => p.id === Number(form.pet_id));
    if (!pet) return;
    try {
      await apiFetch('/api/grooming', ctx, {
        method: 'POST',
        body: JSON.stringify({
          pet_id: pet.id,
          tutor_id: pet.tutor_id,
          service_id: Number(form.service_id),
          taxi_dog: form.taxi_dog,
          taxi_fee: form.taxi_dog ? Number(form.taxi_fee || 0) : 0,
          package_id: form.package_id ? Number(form.package_id) : null,
          notes: form.notes,
        }),
      });
      setShowNew(false);
      setForm((prev) => ({ ...prev, notes: '', taxi_dog: false, package_id: '' }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAdvance(order: GroomingOrder, nextStatus: GroomingOrder['status']) {
    setError(null);
    try {
      await apiFetch(`/api/grooming/${order.id}/status`, ctx, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToComanda(orderId: number) {
    setError(null);
    try {
      await apiFetch(`/api/grooming/${orderId}/to-comanda`, ctx, { method: 'POST' });
      await onRefresh();
      onGoToPos();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.grooming.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.grooming.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.grooming.newOrder}
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

      {/* Active Packages Strip */}
      {packages.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4">
          <div className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5">
            <Package className="w-4 h-4 text-teal-700" />
            {t.grooming.packageBalance}:
          </div>
          {packages.map((pk) => (
            <div key={pk.id} className="text-xs text-slate-700">
              <strong>{pk.pet_name}</strong> ({lang === 'pt-BR' ? pk.name_pt : pk.name_es}):{' '}
              <span className="font-mono-tabular font-bold text-teal-800">
                {pk.total_sessions - pk.used_sessions}/{pk.total_sessions}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 4-column Kanban */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col);
          const nextIdx = COLUMNS.indexOf(col) + 1;
          const nextCol = nextIdx < COLUMNS.length ? COLUMNS[nextIdx] : null;

          return (
            <section key={col} className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-bold text-slate-800">{t.grooming[col]}</h2>
                <span className="text-xs font-mono-tabular font-semibold text-slate-500">{colOrders.length}</span>
              </div>

              <div className="space-y-3">
                {colOrders.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-white/50">
                    —
                  </div>
                ) : (
                  colOrders.map((o) => {
                    const waMsg = t.grooming.waReadyMsg
                      .replace('{tutor}', o.tutor_name || '')
                      .replace('{pet}', o.pet_name || '')
                      .replace('{clinic}', store.name);

                    return (
                      <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-start gap-3">
                          <PetPhoto src={o.photo_ready_url || o.pet_photo} name={o.pet_name || 'Pet'} className="w-11 h-11 rounded-lg" />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-900 truncate">{o.pet_name}</div>
                            <div className="text-xs text-slate-600 truncate">
                              {lang === 'pt-BR' ? o.service_name_pt : o.service_name_es}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{o.tutor_name}</div>
                          </div>
                        </div>

                        {o.taxi_dog === 1 && (
                          <div className="text-[11px] text-teal-800 font-medium inline-flex items-center gap-1">
                            <Car className="w-3.5 h-3.5" />
                            {t.grooming.taxiDog} ({formatCurrency(o.taxi_fee, store.currency)})
                          </div>
                        )}
                        {o.notes && <p className="text-xs text-slate-600">{o.notes}</p>}

                        <div className="flex flex-col gap-1.5 pt-1">
                          {nextCol && (
                            <button
                              type="button"
                              onClick={() => handleAdvance(o, nextCol)}
                              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center justify-center gap-1.5"
                            >
                              <span>{t.grooming[nextCol]}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {o.status === 'ready' && (
                            <a
                              href={buildWhatsAppLink(o.tutor_phone || store.whatsapp, waMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center justify-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-teal-700" />
                              {t.grooming.sendWaPhoto}
                            </a>
                          )}

                          {!o.comanda_id ? (
                            <button
                              type="button"
                              onClick={() => handleToComanda(o.id)}
                              className="w-full min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-1.5"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              {t.grooming.sendComanda}
                            </button>
                          ) : (
                            <div className="text-[11px] text-center text-emerald-700 font-medium">
                              Comanda #{o.comanda_id}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal: New Grooming Order */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.grooming.newOrder}</h3>
              <button type="button" onClick={() => setShowNew(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pet</label>
              <select
                value={form.pet_id}
                onChange={(e) => setForm({ ...form, pet_id: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.tutor_name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {lang === 'pt-BR' ? 'Serviço' : 'Servicio'}
              </label>
              <select
                value={form.service_id}
                onChange={(e) => setForm({ ...form, service_id: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {(groomingServices.length ? groomingServices : services).map((s) => (
                  <option key={s.id} value={s.id}>
                    {lang === 'pt-BR' ? s.name_pt : s.name_es} — {formatCurrency(s.price, store.currency)}
                  </option>
                ))}
              </select>
            </div>
            {packages.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t.grooming.usePackage}</label>
                <select
                  value={form.package_id}
                  onChange={(e) => setForm({ ...form, package_id: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option value="">{lang === 'pt-BR' ? 'Avulso (cobrar serviço)' : 'Individual (cobrar servicio)'}</option>
                  {packages.map((pk) => (
                    <option key={pk.id} value={pk.id}>
                      {pk.pet_name} — {lang === 'pt-BR' ? pk.name_pt : pk.name_es} ({pk.total_sessions - pk.used_sessions} rest.)
                    </option>
                  ))}
                </select>
              </div>
            )}
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.taxi_dog}
                onChange={(e) => setForm({ ...form, taxi_dog: e.target.checked })}
                className="w-4 h-4 accent-teal-700"
              />
              <span>{t.grooming.taxiDog}</span>
            </label>
            {form.taxi_dog && (
              <input
                type="number"
                value={form.taxi_fee}
                onChange={(e) => setForm({ ...form, taxi_fee: e.target.value })}
                placeholder="Taxa Táxi Dog"
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
              />
            )}
            <input
              placeholder={t.patients.notes}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 text-sm"
              >
                {t.patients.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium"
              >
                {t.patients.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
