import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Hospital,
  MessageCircle,
  Plus,
  Scissors,
  X,
} from 'lucide-react';
import type { AppLanguage, AppMode, Hospitalization, Pet, Store, SurgeryRecord } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { buildWhatsAppLink, formatDateTime, formatTimeOnly } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { downloadHospitalBulletinPdf } from '../lib/pdf';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  mode: AppMode;
  pets: Pet[];
  hospitalizations: Hospitalization[];
  surgeries: SurgeryRecord[];
  onRefresh: () => Promise<void>;
}

export function HospitalView({ ctx, store, lang, mode, pets, hospitalizations, surgeries, onRefresh }: Props) {
  const t = getTranslations(lang);
  const [tab, setTab] = useState<'boxes' | 'surgery'>('boxes');
  const [showAdmit, setShowAdmit] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const [admitForm, setAdmitForm] = useState({
    pet_id: String(pets[0]?.id || ''),
    box_code: 'BOX-03 (UTI)',
    risk_level: 'moderate' as Hospitalization['risk_level'],
    care_plan: '',
    first_task_title: 'Medicación + Control signos vitales',
  });

  async function handleAdmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/hospitalizations', ctx, {
        method: 'POST',
        body: JSON.stringify({ ...admitForm, pet_id: Number(admitForm.pet_id) }),
      });
      setShowAdmit(false);
      setAdmitForm((prev) => ({ ...prev, care_plan: '' }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleExecuteTask(taskId: number) {
    setError(null);
    try {
      await apiFetch(`/api/hospitalization-tasks/${taskId}/execute`, ctx, { method: 'POST' });
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddNote(hospId: number) {
    const note = noteDrafts[hospId]?.trim();
    if (!note) return;
    try {
      await apiFetch(`/api/hospitalizations/${hospId}/notes`, ctx, {
        method: 'POST',
        body: JSON.stringify({ note, shift: 'day' }),
      });
      setNoteDrafts((p) => ({ ...p, [hospId]: '' }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleOutcome(hospId: number, status: 'discharged' | 'deceased') {
    try {
      await apiFetch(`/api/hospitalizations/${hospId}/outcome`, ctx, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.hospital.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.hospital.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdmit(true)}
          className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.hospital.admitPet}
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

      {/* Sub-tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTab('boxes')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'boxes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          {t.hospital.boxesTab}
        </button>
        <button
          type="button"
          onClick={() => setTab('surgery')}
          className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            tab === 'surgery' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          {t.hospital.surgeryTab} ({surgeries.length})
        </button>
      </div>

      {tab === 'boxes' ? (
        <div className="space-y-4">
          {hospitalizations.map((h) => {
            const waMsg = t.hospital.waBulletinMsg
              .replace('{pet}', h.pet_name || '')
              .replace('{clinic}', store.name)
              .replace('{box}', h.box_code)
              .replace('{plan}', h.care_plan);

            return (
              <section key={h.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Hospital className="w-4 h-4 text-teal-700" />
                      <span className="text-base font-bold text-slate-900">
                        {h.box_code} · {h.pet_name}
                      </span>
                      <span
                        className={`text-xs font-semibold ${
                          h.risk_level === 'critical'
                            ? 'text-red-700'
                            : h.risk_level === 'moderate'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        ·{' '}
                        {h.risk_level === 'critical'
                          ? t.hospital.riskCritical
                          : h.risk_level === 'moderate'
                            ? t.hospital.riskModerate
                            : t.hospital.riskLow}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Tutor: {h.tutor_name} · {h.attending_vet} · {formatDateTime(h.admitted_at, lang)} ·{' '}
                      <strong>{h.status.toUpperCase()}</strong>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => downloadHospitalBulletinPdf(h, store, lang, mode)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <a
                      href={buildWhatsAppLink(h.tutor_phone || store.whatsapp, waMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-teal-700" />
                      WhatsApp
                    </a>
                    {h.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleOutcome(h.id, 'discharged')}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium"
                      >
                        {t.hospital.dischargePet}
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-sm text-slate-700">{h.care_plan}</div>

                {/* 24h Execution Map */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-800">
                    {lang === 'pt-BR' ? 'Mapa de Execução 24h' : 'Mapa de Ejecución 24h'}
                  </div>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {h.tasks.map((tk) => {
                      const isOverdue = tk.status === 'pending' && new Date(tk.scheduled_time).getTime() < Date.now();
                      return (
                        <div
                          key={tk.id}
                          className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isOverdue ? 'bg-red-50/80' : tk.status === 'done' ? 'bg-slate-50/50' : 'bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {tk.status === 'done' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                            ) : isOverdue ? (
                              <AlertCircle className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <div className={`text-sm font-semibold ${isOverdue ? 'text-red-900' : 'text-slate-900'}`}>
                                {tk.title}
                              </div>
                              <div className="text-xs text-slate-600 font-mono-tabular">
                                {formatTimeOnly(tk.scheduled_time, lang)} ·{' '}
                                {tk.status === 'done'
                                  ? `${t.hospital.doneDose} (${tk.executed_by})`
                                  : isOverdue
                                    ? t.hospital.overdueDose
                                    : lang === 'pt-BR'
                                      ? 'Pendente'
                                      : 'Pendiente'}
                              </div>
                            </div>
                          </div>

                          {tk.status === 'pending' && h.status === 'active' && (
                            <button
                              type="button"
                              onClick={() => handleExecuteTask(tk.id)}
                              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                                isOverdue
                                  ? 'bg-red-700 hover:bg-red-800 text-white'
                                  : 'bg-teal-700 hover:bg-teal-800 text-white'
                              }`}
                            >
                              {t.hospital.executeDose}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Shift Notes */}
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-slate-800">
                    {lang === 'pt-BR' ? 'Evolução de Plantão' : 'Evolución de Guardia'}
                  </div>
                  {h.notes.map((n) => (
                    <div key={n.id} className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <strong>{n.author_name}</strong> · {formatDateTime(n.created_at, lang)}: {n.note}
                    </div>
                  ))}
                  {h.status === 'active' && (
                    <div className="flex gap-2">
                      <input
                        value={noteDrafts[h.id] || ''}
                        onChange={(e) => setNoteDrafts((p) => ({ ...p, [h.id]: e.target.value }))}
                        placeholder={t.hospital.addShiftNote}
                        className="flex-1 h-9 px-3 border border-slate-200 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddNote(h.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap"
                      >
                        {t.patients.save}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {surgeries.map((su) => {
            const checklist = JSON.parse(su.checklist_json || '{}');
            return (
              <div key={su.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Scissors className="w-4 h-4 text-teal-700" />
                    <span>
                      {su.surgery_name} — {su.pet_name}
                    </span>
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-600">{formatDateTime(su.scheduled_at, lang)}</span>
                </div>
                <div className="text-xs text-slate-600">
                  {su.surgeon_name} · {t.hospital.fastingHours}: {su.fasting_hours}h · {t.hospital.anesthetic}:{' '}
                  {su.anesthetic_protocol}
                </div>
                <div className="text-xs text-slate-700 pt-1">
                  Checklist: Pre-exámenes {checklist.preExamsOk ? 'OK' : 'Pend.'} · Consentimiento{' '}
                  {checklist.consentSigned ? 'OK' : 'Pend.'} · Ayuno {checklist.fastingConfirmed ? 'OK' : 'Pend.'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Admit Pet */}
      {showAdmit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleAdmit} className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.hospital.admitPet}</h3>
              <button type="button" onClick={() => setShowAdmit(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <select
              value={admitForm.pet_id}
              onChange={(e) => setAdmitForm({ ...admitForm, pet_id: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
            >
              {pets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.tutor_name})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                value={admitForm.box_code}
                onChange={(e) => setAdmitForm({ ...admitForm, box_code: e.target.value })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
              <select
                value={admitForm.risk_level}
                onChange={(e) => setAdmitForm({ ...admitForm, risk_level: e.target.value as any })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="low">{t.hospital.riskLow}</option>
                <option value="moderate">{t.hospital.riskModerate}</option>
                <option value="critical">{t.hospital.riskCritical}</option>
              </select>
            </div>
            <textarea
              required
              rows={3}
              placeholder="Plan de cuidados..."
              value={admitForm.care_plan}
              onChange={(e) => setAdmitForm({ ...admitForm, care_plan: e.target.value })}
              className="w-full p-3 border border-slate-200 rounded-lg text-sm"
            />
            <input
              placeholder="Primera tarea programada"
              value={admitForm.first_task_title}
              onChange={(e) => setAdmitForm({ ...admitForm, first_task_title: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdmit(false)}
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
