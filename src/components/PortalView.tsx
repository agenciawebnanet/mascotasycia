import React, { useEffect, useState } from 'react';
import { Calendar, Check, FileText, Phone, Syringe } from 'lucide-react';
import type {
  AppLanguage,
  ClinicalDocument,
  Comanda,
  GroomingOrder,
  Pet,
  ServiceItem,
  StaffUser,
  Store,
  Tutor,
  VaccineRecord,
} from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatCurrency, formatDateShort, formatWeight } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { PetPhoto } from './ClinicLogo';

interface PortalData {
  tutor: Tutor;
  pets: Pet[];
  vaccines: VaccineRecord[];
  documents: ClinicalDocument[];
  comandas: Comanda[];
  grooming: GroomingOrder[];
}

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  tutors: Tutor[];
  services: ServiceItem[];
  staff: StaffUser[];
  onBooked: () => Promise<void>;
}

export function PortalView({ ctx, store, lang, tutors, services, staff, onBooked }: Props) {
  const t = getTranslations(lang);
  const [phoneInput, setPhoneInput] = useState(tutors[0]?.phone || '+595983410220');
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bookPetId, setBookPetId] = useState('');
  const [bookServiceId, setBookServiceId] = useState(String(services[0]?.id || ''));
  const [bookDate, setBookDate] = useState(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [bookTime, setBookTime] = useState('10:00');
  const [bookSuccess, setBookSuccess] = useState<string | null>(null);

  async function lookup(phone: string) {
    setError(null);
    try {
      const res = await apiFetch<PortalData>(`/api/portal/lookup?phone=${encodeURIComponent(phone)}`, ctx);
      setData(res);
      if (res.pets[0]) setBookPetId(String(res.pets[0].id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    lookup(phoneInput);
  }, [ctx.mode, ctx.storeId]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setError(null);
    setBookSuccess(null);
    const pro = staff.find((s) => s.role === 'vet') || staff[0];
    const svc = services.find((s) => s.id === Number(bookServiceId));
    const startIso = `${bookDate}T${bookTime}:00`;
    const endDate = new Date(new Date(startIso).getTime() + (svc?.duration_min || 30) * 60000);
    const endIso = `${bookDate}T${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}:00`;
    try {
      await apiFetch('/api/appointments', ctx, {
        method: 'POST',
        body: JSON.stringify({
          pet_id: Number(bookPetId),
          tutor_id: data.tutor.id,
          professional_id: pro.id,
          service_id: svc?.id ?? null,
          type: svc?.category === 'grooming' ? 'banho_tosa' : svc?.category === 'vaccine' ? 'vacina' : 'consulta',
          start_time: startIso,
          end_time: endIso,
          notes: 'Reserva online Portal del Tutor',
        }),
      });
      setBookSuccess(lang === 'pt-BR' ? 'Agendamento confirmado!' : '¡Turno reservado con éxito!');
      await onBooked();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.portal.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t.portal.subtitle}</p>
      </div>

      {/* Phone login bar + Demo quick tutor selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+595..."
              className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
            />
          </div>
          <button
            type="button"
            onClick={() => lookup(phoneInput)}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium whitespace-nowrap"
          >
            {t.portal.phoneLogin}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">{t.portal.selectTutorDemo}:</span>
          {tutors.map((tu) => (
            <button
              key={tu.id}
              type="button"
              onClick={() => {
                setPhoneInput(tu.phone);
                lookup(tu.phone);
              }}
              className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
            >
              {tu.name}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{error}</div>}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            {/* My Pets */}
            <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900">
                {t.portal.myPets} — {data.tutor.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.pets.map((p) => (
                  <div key={p.id} className="p-3.5 border border-slate-200 rounded-xl flex items-center gap-3">
                    <PetPhoto src={p.photo_url} name={p.name} className="w-12 h-12 rounded-xl" />
                    <div>
                      <div className="font-bold text-sm text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">
                        {p.breed} · {formatWeight(p.weight_kg, lang)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Vaccines */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-sm text-slate-900 flex items-center gap-2">
                <Syringe className="w-4 h-4 text-teal-700" />
                <span>{t.portal.vaccinesCard}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {data.vaccines.map((v) => {
                  const pet = data.pets.find((p) => p.id === v.pet_id);
                  const overdue = v.next_due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={v.id} className="p-4 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {pet?.name} · {v.vaccine_name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {v.dose_number} · Lote {v.batch_code}
                        </div>
                      </div>
                      <div className={`text-xs font-mono-tabular font-semibold ${overdue ? 'text-red-700' : 'text-teal-800'}`}>
                        {t.vaccines.nextDue}: {formatDateShort(v.next_due_date, lang)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Released Documents */}
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-sm text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-700" />
                <span>{t.portal.releasedDocs}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {data.documents.length === 0 ? (
                  <div className="p-4 text-xs text-slate-400">—</div>
                ) : (
                  data.documents.map((d) => (
                    <div key={d.id} className="p-4 space-y-1">
                      <div className="text-sm font-semibold text-slate-900">{d.title}</div>
                      <p className="text-xs text-slate-600">{d.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right: Online Booking + Invoices */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleBook} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal-700" />
                <span>{t.portal.bookOnline}</span>
              </h2>
              {bookSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>{bookSuccess}</span>
                </div>
              )}
              <select
                value={bookPetId}
                onChange={(e) => setBookPetId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {data.pets.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={bookServiceId}
                onChange={(e) => setBookServiceId(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {lang === 'pt-BR' ? s.name_pt : s.name_es} — {formatCurrency(s.price, store.currency)}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={bookDate}
                  onChange={(e) => setBookDate(e.target.value)}
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
                />
                <select
                  value={bookTime}
                  onChange={(e) => setBookTime(e.target.value)}
                  className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {['09:00', '10:00', '11:00', '14:00', '15:30', '17:00'].map((hr) => (
                    <option key={hr} value={hr}>
                      {hr}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium"
              >
                {t.portal.confirmBooking}
              </button>
            </form>

            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-sm text-slate-900">
                {t.portal.invoices}
              </div>
              <div className="divide-y divide-slate-100">
                {data.comandas.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">Comanda #{c.id}</div>
                      <div className="text-xs text-slate-500">
                        {formatDateShort(c.created_at, lang)} · {c.status.toUpperCase()}
                      </div>
                    </div>
                    <div className="font-mono-tabular font-bold text-slate-900">
                      {formatCurrency(c.total, store.currency)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
