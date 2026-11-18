import React, { useMemo, useState } from 'react';
import { Calendar, CheckCircle2, MessageCircle, Plus, Ticket, X } from 'lucide-react';
import type { AppLanguage, Appointment, Pet, ServiceItem, StaffUser, Store } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { buildWhatsAppLink, formatDateShort, formatTimeOnly } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  pets: Pet[];
  staff: StaffUser[];
  services: ServiceItem[];
  appointments: Appointment[];
  onRefresh: () => Promise<void>;
}

export function AgendaView({ ctx, store, lang, pets, staff, services, appointments, onRefresh }: Props) {
  const t = getTranslations(lang);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const professionals = useMemo(
    () => staff.filter((u) => u.role === 'vet' || u.role === 'groomer'),
    [staff],
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    pet_id: String(pets[0]?.id || ''),
    professional_id: String(professionals[0]?.id || staff[0]?.id || ''),
    service_id: String(services[0]?.id || ''),
    type: 'consulta' as Appointment['type'],
    date: todayStr,
    time: '11:00',
    notes: '',
    is_squeeze_in: false,
  });

  const visibleAppointments = useMemo(() => {
    if (viewMode === 'day') {
      return appointments.filter((a) => a.start_time.startsWith(todayStr));
    }
    if (viewMode === 'week') {
      const limit = new Date(Date.now() + 7 * 86400000).toISOString();
      return appointments.filter((a) => a.start_time <= limit);
    }
    return appointments;
  }, [appointments, viewMode, todayStr]);

  const queueTickets = useMemo(
    () => appointments.filter((a) => a.queue_ticket && (a.status === 'checked_in' || a.status === 'in_progress')),
    [appointments],
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const pet = pets.find((p) => p.id === Number(form.pet_id));
    if (!pet) return;
    const svc = services.find((s) => s.id === Number(form.service_id));
    const dur = svc?.duration_min || 30;
    const startIso = `${form.date}T${form.time}:00`;
    const endMs = new Date(startIso).getTime() + dur * 60000;
    const endDate = new Date(endMs);
    const endIso = `${form.date}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;

    try {
      await apiFetch('/api/appointments', ctx, {
        method: 'POST',
        body: JSON.stringify({
          pet_id: pet.id,
          tutor_id: pet.tutor_id,
          professional_id: Number(form.professional_id),
          service_id: svc?.id ?? null,
          type: form.type,
          start_time: startIso,
          end_time: endIso,
          notes: form.notes,
          is_squeeze_in: form.is_squeeze_in,
        }),
      });
      setShowNew(false);
      setForm((prev) => ({ ...prev, notes: '', is_squeeze_in: false }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleStatus(id: number, status: Appointment['status']) {
    setError(null);
    try {
      await apiFetch(`/api/appointments/${id}/status`, ctx, {
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
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.agenda.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.agenda.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['day', 'week', 'month'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  viewMode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {m === 'day' ? t.agenda.dayView : m === 'week' ? t.agenda.weekView : t.agenda.monthView}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowNew(true);
            }}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {t.agenda.newAppt}
          </button>
        </div>
      </div>

      {/* Live Reception Call Panel */}
      {queueTickets.length > 0 && (
        <section className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-300">
            <Ticket className="w-4 h-4" />
            <span>{t.agenda.callPanel}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {queueTickets.map((q) => (
              <div key={q.id} className="text-xs">
                <span className="font-mono-tabular font-bold text-base text-white mr-1.5">{q.queue_ticket}</span>
                <span className="text-slate-300">
                  {q.pet_name} · {q.professional_name}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Multi-professional columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {professionals.map((pro) => {
          const proAppts = visibleAppointments.filter((a) => a.professional_id === pro.id);
          return (
            <section key={pro.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
              <div className="px-4 py-3.5 bg-slate-50 border-b border-slate-200">
                <div className="text-sm font-bold text-slate-900">{pro.name}</div>
                <div className="text-xs text-slate-500">
                  {pro.specialty || pro.role} · {proAppts.length} {lang === 'pt-BR' ? 'horário(s)' : 'turno(s)'}
                </div>
              </div>
              <div className="divide-y divide-slate-100 flex-1">
                {proAppts.length === 0 ? (
                  <div className="p-6 text-xs text-slate-400 text-center">
                    {lang === 'pt-BR' ? 'Agenda livre neste período.' : 'Agenda libre en este período.'}
                  </div>
                ) : (
                  proAppts.map((a) => {
                    const waMsg = t.agenda.waApptMsg
                      .replace('{tutor}', a.tutor_name || '')
                      .replace('{pet}', a.pet_name || '')
                      .replace('{clinic}', store.name)
                      .replace('{date}', formatDateShort(a.start_time, lang))
                      .replace('{time}', formatTimeOnly(a.start_time, lang))
                      .replace('{pro}', pro.name);

                    return (
                      <div key={a.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-mono-tabular font-semibold text-teal-800">
                              {formatDateShort(a.start_time, lang)} · {formatTimeOnly(a.start_time, lang)}
                              {a.is_squeeze_in ? (lang === 'pt-BR' ? ' · Encaixe' : ' · Encaje') : ''}
                            </div>
                            <div className="text-sm font-bold text-slate-900 mt-0.5">
                              {a.pet_name} · <span className="font-normal text-slate-600">{t.agenda.types[a.type]}</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              Tutor: {a.tutor_name} {a.queue_ticket ? `· Senha ${a.queue_ticket}` : ''}
                            </div>
                          </div>
                          <span className="text-[11px] font-medium text-slate-600 shrink-0">
                            {t.agenda.statuses[a.status]}
                          </span>
                        </div>
                        {a.notes && <p className="text-xs text-slate-600">{a.notes}</p>}

                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {a.status === 'scheduled' && (
                            <button
                              type="button"
                              onClick={() => handleStatus(a.id, 'checked_in')}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <Ticket className="w-3 h-3" />
                              Check-in
                            </button>
                          )}
                          {a.status === 'checked_in' && (
                            <button
                              type="button"
                              onClick={() => handleStatus(a.id, 'completed')}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-medium inline-flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {lang === 'pt-BR' ? 'Concluir' : 'Finalizar'}
                            </button>
                          )}
                          <a
                            href={buildWhatsAppLink(a.tutor_phone || store.whatsapp, waMsg)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-[11px] font-medium text-slate-700 inline-flex items-center gap-1"
                          >
                            <MessageCircle className="w-3 h-3 text-teal-700" />
                            WhatsApp
                          </a>
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

      {/* Modal: New Appointment */}
      {showNew && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-y-auto">
          <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                {t.agenda.newAppt}
              </h3>
              <button type="button" onClick={() => setShowNew(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  {lang === 'pt-BR' ? 'Profissional' : 'Profesional'}
                </label>
                <select
                  value={form.professional_id}
                  onChange={(e) => setForm({ ...form, professional_id: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {professionals.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {lang === 'pt-BR' ? 'Tipo' : 'Tipo'}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {Object.entries(t.agenda.types).map(([k, lbl]) => (
                    <option key={k} value={k}>
                      {lbl}
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
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {lang === 'pt-BR' ? s.name_pt : s.name_es}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <input
              placeholder={t.patients.notes}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={form.is_squeeze_in}
                onChange={(e) => setForm({ ...form, is_squeeze_in: e.target.checked })}
                className="w-4 h-4 accent-teal-700"
              />
              <span>{t.agenda.squeezeIn}</span>
            </label>
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
