import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Download, MessageCircle, Plus, Syringe, X } from 'lucide-react';
import type { AppLanguage, AppMode, Pet, Store, VaccineRecord } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { buildWhatsAppLink, formatDateShort, formatDateTime } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { downloadVaccinesPdf } from '../lib/pdf';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  mode: AppMode;
  pets: Pet[];
  vaccines: VaccineRecord[];
  onRefresh: () => Promise<void>;
}

const PROTOCOLS = [
  { code: 'CAN-V10', label: 'Polivalente V10 (Canino)', days: 365 },
  { code: 'CAN-RAB', label: 'Antirrábica Canina', days: 365 },
  { code: 'CAN-TOS', label: 'Gripe / Tos de las Perreras', days: 365 },
  { code: 'FEL-TRI', label: 'Triple Felina FVRCP', days: 365 },
  { code: 'FEL-RAB', label: 'Antirrábica Felina', days: 365 },
];

export function VaccinesView({ ctx, store, lang, mode, pets, vaccines, onRefresh }: Props) {
  const t = getTranslations(lang);
  const [tab, setTab] = useState<'active' | 'cards'>('active');
  const [selectedPetFilter, setSelectedPetFilter] = useState<number | 'all'>('all');
  const [showApply, setShowApply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [form, setForm] = useState({
    pet_id: String(pets[0]?.id || ''),
    protocol_code: 'CAN-V10',
    vaccine_name: 'Polivalente V10 (Óctuple/Décuple)',
    dose_number: 'Refuerzo Anual',
    applied_date: todayStr,
    next_due_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
    batch_code: '',
    manufacturer: 'Zoetis',
  });

  const activeAlerts = useMemo(
    () => vaccines.filter((v) => v.next_due_date <= in30DaysStr),
    [vaccines, in30DaysStr],
  );

  const filteredCards = useMemo(() => {
    if (selectedPetFilter === 'all') return vaccines;
    return vaccines.filter((v) => v.pet_id === selectedPetFilter);
  }, [vaccines, selectedPetFilter]);

  function daysDiff(targetIso: string): number {
    const t0 = new Date(todayStr).getTime();
    const t1 = new Date(targetIso.slice(0, 10)).getTime();
    return Math.round((t1 - t0) / 86400000);
  }

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/vaccines', ctx, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          pet_id: Number(form.pet_id),
        }),
      });
      setShowApply(false);
      setForm((prev) => ({ ...prev, batch_code: '' }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleRemind(v: VaccineRecord) {
    try {
      await apiFetch(`/api/vaccines/${v.id}/remind`, ctx, {
        method: 'POST',
        body: JSON.stringify({ note: `WhatsApp enviado a ${v.tutor_name}` }),
      });
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.vaccines.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.vaccines.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowApply(true)}
          className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.vaccines.applyVaccine}
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

      {/* Segmented filter tabs */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3">
        <div className="grid w-full grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg sm:w-auto sm:inline-flex">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-2 sm:px-3.5 py-2 rounded-md text-[11px] sm:text-xs font-medium leading-tight transition-colors text-center ${
              tab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.vaccines.activeSearch} ({activeAlerts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('cards')}
            className={`px-2 sm:px-3.5 py-2 rounded-md text-[11px] sm:text-xs font-medium leading-tight transition-colors text-center ${
              tab === 'cards' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.vaccines.allCards} ({vaccines.length})
          </button>
        </div>

        {tab === 'cards' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPetFilter}
              onChange={(e) => setSelectedPetFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="h-9 px-3 border border-slate-200 rounded-lg text-xs bg-white max-w-full"
            >
              <option value="all">{lang === 'pt-BR' ? 'Todos os pets' : 'Todos los pets'}</option>
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {selectedPetFilter !== 'all' && (
              <button
                type="button"
                onClick={() => {
                  const pet = pets.find((p) => p.id === selectedPetFilter);
                  if (pet) downloadVaccinesPdf(pet, filteredCards, store, lang, mode);
                }}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Search View */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeAlerts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
              {lang === 'pt-BR' ? 'Nenhuma vacina vencida ou a vencer em 30 dias.' : 'Sin vacunas vencidas ni por vencer en 30 días.'}
            </div>
          ) : (
            activeAlerts.map((v) => {
              const diff = daysDiff(v.next_due_date);
              const isOverdue = diff < 0;
              const waMsg = t.vaccines.waVaccineMsg
                .replace('{tutor}', v.tutor_name || '')
                .replace('{clinic}', store.name)
                .replace('{pet}', v.pet_name || '')
                .replace('{vaccine}', v.vaccine_name)
                .replace('{date}', formatDateShort(v.next_due_date, lang));

              return (
                <div
                  key={v.id}
                  className={`rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    isOverdue ? 'bg-red-50/70 border-red-200' : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {isOverdue ? (
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-700 shrink-0" />
                      )}
                      <span className={`text-xs font-bold ${isOverdue ? 'text-red-800' : 'text-amber-900'}`}>
                        {isOverdue
                          ? `${t.vaccines.overdue} (${Math.abs(diff)} ${t.vaccines.daysOverdue})`
                          : `${t.vaccines.dueSoon} (${diff} ${t.vaccines.daysLeft})`}
                      </span>
                    </div>
                    <div className="text-base font-bold text-slate-900">
                      {v.pet_name} · {v.vaccine_name}
                    </div>
                    <div className="text-xs text-slate-700">
                      Tutor: <strong>{v.tutor_name}</strong> ({v.tutor_phone}) · {t.vaccines.nextDue}:{' '}
                      <strong className="font-mono-tabular">{formatDateShort(v.next_due_date, lang)}</strong>
                    </div>
                    {v.reminded_at && (
                      <div className="text-[11px] text-teal-800 font-medium">
                        {t.vaccines.remindedOn} {formatDateTime(v.reminded_at, lang)} · {v.reminded_note}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={buildWhatsAppLink(v.tutor_phone || store.whatsapp, waMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleRemind(v)}
                      className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {t.vaccines.remindWhatsApp}
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Digital Vaccination Card List */}
      {tab === 'cards' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
          {filteredCards.map((v) => {
            const diff = daysDiff(v.next_due_date);
            const isOverdue = diff < 0;
            const isSoon = diff >= 0 && diff <= 30;
            return (
              <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Syringe className="w-4 h-4 text-teal-700 shrink-0" />
                    <span className="text-sm font-bold text-slate-900">
                      {v.pet_name} · {v.vaccine_name}
                    </span>
                    <span className="text-xs text-slate-500">({v.dose_number})</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {t.vaccines.appliedDate}: <span className="font-mono-tabular">{formatDateShort(v.applied_date, lang)}</span> ·{' '}
                    {t.vaccines.batch}: <span className="font-mono-tabular">{v.batch_code}</span> ({v.manufacturer}) · {v.vet_name}
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <div
                    className={`text-xs font-semibold inline-flex items-center gap-1 ${
                      isOverdue ? 'text-red-700' : isSoon ? 'text-amber-700' : 'text-emerald-700'
                    }`}
                  >
                    {isOverdue ? (
                      <AlertCircle className="w-3.5 h-3.5" />
                    ) : isSoon ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {isOverdue ? t.vaccines.overdue : isSoon ? t.vaccines.dueSoon : t.vaccines.upToDate}
                  </div>
                  <div className="text-xs font-mono-tabular text-slate-700 mt-0.5">
                    {t.vaccines.nextDue}: {formatDateShort(v.next_due_date, lang)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Apply Vaccine */}
      {showApply && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-y-auto">
          <form onSubmit={handleApply} className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.vaccines.applyVaccine}</h3>
              <button type="button" onClick={() => setShowApply(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pet *</label>
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
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.vaccines.protocol}</label>
              <select
                value={form.protocol_code}
                onChange={(e) => {
                  const p = PROTOCOLS.find((x) => x.code === e.target.value);
                  setForm({
                    ...form,
                    protocol_code: e.target.value,
                    vaccine_name: p?.label || form.vaccine_name,
                  });
                }}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {PROTOCOLS.map((pr) => (
                  <option key={pr.code} value={pr.code}>
                    {pr.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t.vaccines.doseNumber}</label>
                <input
                  required
                  value={form.dose_number}
                  onChange={(e) => setForm({ ...form, dose_number: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t.vaccines.batch} *</label>
                <input
                  required
                  value={form.batch_code}
                  onChange={(e) => setForm({ ...form, batch_code: e.target.value })}
                  placeholder="LOT-2026-A"
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t.vaccines.appliedDate}</label>
                <input
                  type="date"
                  required
                  value={form.applied_date}
                  onChange={(e) => setForm({ ...form, applied_date: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t.vaccines.nextDue} *</label>
                <input
                  type="date"
                  required
                  value={form.next_due_date}
                  onChange={(e) => setForm({ ...form, next_due_date: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.vaccines.manufacturer}</label>
              <input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowApply(false)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 text-sm"
              >
                {t.patients.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium"
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
