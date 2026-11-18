import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  FileText,
  Hospital,
  MessageCircle,
  ShoppingBag,
  Syringe,
  UserPlus,
} from 'lucide-react';
import type {
  AppLanguage,
  Appointment,
  Comanda,
  GroomingOrder,
  Hospitalization,
  Pet,
  Store,
  VaccineRecord,
} from '../shared/types';
import { buildWhatsAppLink, formatCurrency, formatDateShort, formatTimeOnly, formatWeight } from '../shared/currency';
import { getTranslations } from '../shared/i18n';
import { PetPhoto } from './ClinicLogo';

interface Props {
  store: Store;
  lang: AppLanguage;
  pets: Pet[];
  appointments: Appointment[];
  vaccines: VaccineRecord[];
  hospitalizations: Hospitalization[];
  grooming: GroomingOrder[];
  comandas: Comanda[];
  onOpenRecord: (petId: number) => void;
  onNavigate: (tab: string) => void;
}

export function DashboardView({
  store,
  lang,
  pets,
  appointments,
  vaccines,
  hospitalizations,
  grooming,
  comandas,
  onOpenRecord,
  onNavigate,
}: Props) {
  const t = getTranslations(lang);
  const todayStr = new Date().toISOString().slice(0, 10);
  const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const todayAppts = appointments.filter((a) => a.start_time.startsWith(todayStr) && a.status !== 'cancelled');
  const activeHosp = hospitalizations.filter((h) => h.status === 'active');
  const alertVaccines = vaccines.filter((v) => v.next_due_date <= in30DaysStr);
  const paidToday = comandas
    .filter((c) => c.status === 'paid' && (c.paid_at || c.created_at).startsWith(todayStr))
    .reduce((acc, c) => acc + c.total, 0);
  const readyGrooming = grooming.filter((g) => g.status === 'ready');

  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.dashboard.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('patients')}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {t.dashboard.newTutorPet}
          </button>
          <button
            type="button"
            onClick={() => {
              if (pets[0]) onOpenRecord(pets[0].id);
            }}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            {t.dashboard.newConsult}
          </button>
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            {t.dashboard.goPos}
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onNavigate('agenda')}
          className="text-left bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[104px] hover:border-teal-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 text-[11px] sm:text-xs text-slate-500">
            <span className="leading-tight">{t.dashboard.todayAgenda}</span>
            <Calendar className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5 whitespace-nowrap">{todayAppts.length}</div>
          <div className="text-xs text-slate-500 mt-1">
            {todayAppts.filter((a) => a.status === 'checked_in').length} {lang === 'pt-BR' ? 'em espera' : 'en espera'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('hospital')}
          className="text-left bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[104px] hover:border-teal-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 text-[11px] sm:text-xs text-slate-500">
            <span className="leading-tight">{t.dashboard.hospitalized}</span>
            <Hospital className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5 whitespace-nowrap">{activeHosp.length}</div>
          <div className="text-xs text-red-700 font-medium mt-1">
            {activeHosp.reduce(
              (cnt, h) =>
                cnt + h.tasks.filter((tk) => tk.status === 'pending' && new Date(tk.scheduled_time).getTime() < Date.now()).length,
              0,
            )}{' '}
            {t.dashboard.overdueDose}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('vaccines')}
          className="text-left bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[104px] hover:border-teal-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 text-[11px] sm:text-xs text-slate-500">
            <span className="leading-tight">{t.dashboard.vaccinesAlert}</span>
            <Syringe className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5 whitespace-nowrap">{alertVaccines.length}</div>
          <div className="text-xs text-red-700 font-medium mt-1">
            {alertVaccines.filter((v) => v.next_due_date < todayStr).length}{' '}
            {lang === 'pt-BR' ? 'atrasada(s)' : 'vencida(s)'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('pos')}
          className="text-left bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex flex-col justify-between min-h-[104px] hover:border-teal-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 text-[11px] sm:text-xs text-slate-500">
            <span className="leading-tight">{t.dashboard.todaySales}</span>
            <ShoppingBag className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono-tabular mt-1.5 whitespace-nowrap">
            {formatCurrency(paidToday, store.currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {comandas.filter((c) => c.status === 'open').length}{' '}
            {lang === 'pt-BR' ? 'comanda(s) aberta(s)' : 'comanda(s) abierta(s)'}
          </div>
        </button>
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Featured Patients & Direct 1-Click Jump to Prontuário */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">{t.dashboard.featuredPatients}</h2>
            <button
              type="button"
              onClick={() => onNavigate('patients')}
              className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap"
            >
              {lang === 'pt-BR' ? 'Ver todos' : 'Ver todos'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {pets.slice(0, 6).map((pet) => {
              const petOverdue = vaccines.find((v) => v.pet_id === pet.id && v.next_due_date < todayStr);
              return (
                <div
                  key={pet.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <PetPhoto src={pet.photo_url} name={pet.name} className="w-12 h-12 rounded-xl" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{pet.name}</span>
                        <span className="text-xs text-slate-500">
                          {pet.breed} · {formatWeight(pet.weight_kg, lang)} · Tutor: {pet.tutor_name}
                        </span>
                      </div>
                      {pet.allergies && (
                        <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{pet.allergies}</span>
                        </div>
                      )}
                      {petOverdue && (
                        <div className="mt-1 text-xs font-medium text-red-700">
                          {t.vaccines.overdue}: {petOverdue.vaccine_name} ({formatDateShort(petOverdue.next_due_date, lang)})
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenRecord(pet.id)}
                      className="min-h-[40px] px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium whitespace-nowrap transition-colors"
                    >
                      {t.dashboard.openRecord}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Vaccines + Hospitalization + Ready Grooming */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Vaccine Alerts */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{t.dashboard.overdueVaccinesList}</h2>
              <button
                type="button"
                onClick={() => onNavigate('vaccines')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                {lang === 'pt-BR' ? 'Busca ativa' : 'Búsqueda activa'}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {alertVaccines.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">
                  {lang === 'pt-BR' ? 'Nenhuma vacina vencida ou próxima.' : 'Sin vacunas vencidas ni próximas.'}
                </div>
              ) : (
                alertVaccines.map((v) => {
                  const isOverdue = v.next_due_date < todayStr;
                  const waText = t.vaccines.waVaccineMsg
                    .replace('{tutor}', v.tutor_name || '')
                    .replace('{clinic}', store.name)
                    .replace('{pet}', v.pet_name || '')
                    .replace('{vaccine}', v.vaccine_name)
                    .replace('{date}', formatDateShort(v.next_due_date, lang));
                  return (
                    <div key={v.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900">
                          {v.pet_name} · {v.vaccine_name}
                        </div>
                        <div className={`text-xs font-medium mt-0.5 ${isOverdue ? 'text-red-700' : 'text-amber-700'}`}>
                          {isOverdue ? t.vaccines.overdue : t.vaccines.dueSoon} · {formatDateShort(v.next_due_date, lang)}
                        </div>
                        <div className="text-xs text-slate-500">{v.tutor_name}</div>
                      </div>
                      <a
                        href={buildWhatsAppLink(v.tutor_phone || store.whatsapp, waText)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-teal-700" />
                        WhatsApp
                      </a>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Hospitalization Boxes & Grooming Ready */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{t.dashboard.hospitalBoard}</h2>
              <button
                type="button"
                onClick={() => onNavigate('hospital')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                {lang === 'pt-BR' ? 'Mapa 24h' : 'Mapa 24h'}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {activeHosp.map((h) => {
                const overdueTasks = h.tasks.filter(
                  (tk) => tk.status === 'pending' && new Date(tk.scheduled_time).getTime() < Date.now(),
                );
                return (
                  <div key={h.id} className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {h.box_code} · {h.pet_name}
                      </span>
                      {overdueTasks.length > 0 && (
                        <span className="text-xs font-semibold text-red-700">
                          {overdueTasks.length} {t.dashboard.overdueDose}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{h.care_plan}</p>
                  </div>
                );
              })}

              {readyGrooming.map((g) => (
                <div key={g.id} className="p-4 flex items-center justify-between gap-3 bg-teal-50/40">
                  <div>
                    <div className="text-xs font-semibold text-teal-800">
                      {t.grooming.ready}: {g.pet_name}
                    </div>
                    <div className="text-xs text-slate-600">
                      {lang === 'pt-BR' ? g.service_name_pt : g.service_name_es} · {g.tutor_name}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('grooming')}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                  >
                    Kanban
                  </button>
                </div>
              ))}

              {todayAppts.slice(0, 2).map((a) => (
                <div key={a.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-mono-tabular font-semibold text-slate-800">
                      {formatTimeOnly(a.start_time, lang)}
                    </span>{' '}
                    · <span className="font-semibold text-slate-900">{a.pet_name}</span> ({a.professional_name})
                  </div>
                  <span className="text-slate-500">{t.agenda.statuses[a.status]}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
