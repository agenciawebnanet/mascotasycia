import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Hospital,
  MessageCircle,
  Package,
  PawPrint,
  Scissors,
  ShoppingBag,
  Stethoscope,
  Syringe,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import type {
  AppLanguage,
  Appointment,
  AuditLog,
  Comanda,
  FinancialEntry,
  GroomingOrder,
  Hospitalization,
  Pet,
  Product,
  Store,
  VaccineRecord,
} from '../shared/types';
import { buildWhatsAppLink, formatCurrency, formatDateShort, formatTimeOnly, formatWeight } from '../shared/currency';
import { getTranslations } from '../shared/i18n';
import { PetPhoto } from './ClinicLogo';

interface ConsolidatedRow {
  store_id: number;
  name: string;
  city: string;
  currency: Store['currency'];
  pets_count: number;
  appointments_count: number;
  paid_revenue: number;
}

interface Props {
  store: Store;
  lang: AppLanguage;
  userName?: string;
  role?: string;
  pets: Pet[];
  appointments: Appointment[];
  vaccines: VaccineRecord[];
  hospitalizations: Hospitalization[];
  grooming: GroomingOrder[];
  comandas: Comanda[];
  products: Product[];
  financeEntries: FinancialEntry[];
  auditLogs: AuditLog[];
  consolidated: ConsolidatedRow[];
  onOpenRecord: (petId: number) => void;
  onNavigate: (tab: string) => void;
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const AUDIT_LABELS: Record<string, string> = {
  CREATE_TUTOR: 'Tutor registrado',
  CREATE_PET: 'Paciente registrado',
  CREATE_CONSULTATION: 'Consulta creada',
  ADD_ADDENDUM: 'Nota clínica añadida',
  CREATE_PRESCRIPTION: 'Receta emitida',
  APPLY_VACCINE: 'Vacuna aplicada',
  CREATE_APPOINTMENT: 'Turno agendado',
  UPDATE_APPOINTMENT_STATUS: 'Turno actualizado',
  CREATE_GROOMING: 'Baño y tosa registrado',
  UPDATE_GROOMING_STATUS: 'Estética actualizada',
  SEND_GROOMING_TO_COMANDA: 'Estética enviada a caja',
  ADD_HOSP_NOTE: 'Evolución de guardia',
  HOSP_OUTCOME: 'Alta de internación',
  UPDATE_STORE: 'Configuración actualizada',
  CHECKOUT_COMANDA: 'Venta cerrada',
  ADD_COMANDA_ITEM: 'Ítem agregado a comanda',
  CREATE_COMANDA: 'Comanda abierta',
  CREATE_DOCUMENT: 'Documento emitido',
  TOGGLE_DOCUMENT_RELEASE: 'Documento liberado al tutor',
  LGPD_EXPORT: 'Datos exportados (LGPD)',
  LGPD_ANONYMIZE: 'Tutor anonimizado',
};

function auditLabel(action: string) {
  return AUDIT_LABELS[action] || action.replaceAll('_', ' ').toLowerCase();
}

function greetingFor(hour: number) {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function DashboardView({
  store,
  lang,
  userName,
  role,
  pets,
  appointments,
  vaccines,
  hospitalizations,
  grooming,
  comandas,
  products,
  financeEntries,
  auditLogs,
  consolidated,
  onOpenRecord,
  onNavigate,
}: Props) {
  const t = getTranslations(lang);
  const now = new Date();
  const todayStr = localDateKey(now);
  const in30DaysStr = localDateKey(new Date(Date.now() + 30 * 86400000));

  const todayAppts = appointments
    .filter((a) => a.start_time.startsWith(todayStr) && a.status !== 'cancelled')
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  const activeHosp = hospitalizations.filter((h) => h.status === 'active');
  const overdueHospTasks = activeHosp.reduce(
    (cnt, h) =>
      cnt + h.tasks.filter((tk) => tk.status === 'pending' && new Date(tk.scheduled_time).getTime() < Date.now()).length,
    0,
  );
  const alertVaccines = vaccines
    .filter((v) => v.next_due_date <= in30DaysStr)
    .sort((a, b) => a.next_due_date.localeCompare(b.next_due_date));
  const overdueVaccines = alertVaccines.filter((v) => v.next_due_date < todayStr);
  const openComandas = comandas.filter((c) => c.status === 'open');
  const paidToday = comandas
    .filter((c) => c.status === 'paid' && (c.paid_at || c.created_at).startsWith(todayStr))
    .reduce((acc, c) => acc + c.total, 0);
  const paidTodayCount = comandas.filter(
    (c) => c.status === 'paid' && (c.paid_at || c.created_at).startsWith(todayStr),
  ).length;
  const ticketAvg = paidTodayCount > 0 ? paidToday / paidTodayCount : 0;
  const fiadoOpen = comandas.filter((c) => c.status === 'fiado');
  const fiadoTotal = fiadoOpen.reduce((acc, c) => acc + c.total, 0);
  const readyGrooming = grooming.filter((g) => g.status === 'ready');
  const lowStock = products.filter((p) => p.stock_qty <= p.min_stock);
  const allergyPets = pets.filter((p) => p.allergies);

  const receivable = financeEntries
    .filter((e) => e.type === 'income' && e.status === 'pending')
    .reduce((acc, e) => acc + e.amount, 0);
  const payable = financeEntries
    .filter((e) => e.type === 'expense' && e.status === 'pending')
    .reduce((acc, e) => acc + e.amount, 0);
  const commissions = financeEntries
    .filter((e) => e.type === 'income' && e.status === 'paid' && e.commission_pct > 0)
    .reduce((acc, e) => acc + (e.amount * e.commission_pct) / 100, 0);
  const monthRevenue = financeEntries
    .filter((e) => e.type === 'income' && e.status === 'paid' && e.due_date.startsWith(todayStr.slice(0, 7)))
    .reduce((acc, e) => acc + e.amount, 0);

  const standardBoxes = ['BOX-01', 'BOX-02', 'BOX-03', 'BOX-04'];
  const boxCodes = Array.from(
    new Set([
      ...standardBoxes,
      ...activeHosp.map((h) => h.box_code.match(/BOX-\d+/)?.[0] ?? h.box_code),
    ]),
  );
  const occupancy = boxCodes.length ? Math.round((activeHosp.length / boxCodes.length) * 100) : 0;

  const firstName = (userName || '')
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(' ');

  const alerts = [
    {
      id: 'vaccines',
      tab: 'vaccines',
      label: 'Vacunas vencidas',
      value: overdueVaccines.length,
      detail: `${alertVaccines.length} en los próximos 30 días`,
      icon: Syringe,
      tone: overdueVaccines.length ? 'amber' : 'emerald',
    },
    {
      id: 'hospital',
      tab: 'hospital',
      label: 'Tareas de internación',
      value: overdueHospTasks,
      detail: `${activeHosp.length} paciente(s) internado(s)`,
      icon: Hospital,
      tone: overdueHospTasks ? 'rose' : 'emerald',
    },
    {
      id: 'comandas',
      tab: 'pos',
      label: 'Comandas abiertas',
      value: openComandas.length,
      detail: formatCurrency(
        openComandas.reduce((acc, c) => acc + c.total, 0),
        store.currency,
      ),
      icon: ShoppingBag,
      tone: openComandas.length ? 'violet' : 'emerald',
    },
    {
      id: 'fiado',
      tab: 'pos',
      label: 'Fiado por cobrar',
      value: fiadoOpen.length,
      detail: formatCurrency(fiadoTotal, store.currency),
      icon: Wallet,
      tone: fiadoTotal > 0 ? 'rose' : 'emerald',
    },
    {
      id: 'stock',
      tab: 'inventory',
      label: 'Stock bajo mínimo',
      value: lowStock.length,
      detail: lowStock.length ? 'Reponer antes del quiebre' : 'Inventario saludable',
      icon: Package,
      tone: lowStock.length ? 'amber' : 'emerald',
    },
    {
      id: 'grooming',
      tab: 'grooming',
      label: 'Listos para entregar',
      value: readyGrooming.length,
      detail: readyGrooming.length ? 'Avisar al tutor por WhatsApp' : 'Sin pendientes de estética',
      icon: Scissors,
      tone: readyGrooming.length ? 'violet' : 'emerald',
    },
  ];

  const toneStyles: Record<string, { tile: string; value: string; ring: string }> = {
    amber: { tile: 'bg-amber-50 text-amber-700', value: 'text-amber-700', ring: 'ring-amber-100' },
    rose: { tile: 'bg-rose-50 text-rose-600', value: 'text-rose-600', ring: 'ring-rose-100' },
    violet: { tile: 'bg-teal-50 text-teal-700', value: 'text-teal-800', ring: 'ring-teal-100' },
    emerald: { tile: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-700', ring: 'ring-emerald-100' },
  };

  const statusChip: Record<Appointment['status'], string> = {
    scheduled: 'bg-slate-100 text-slate-600',
    checked_in: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-teal-100 text-teal-800',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-rose-100 text-rose-700',
  };

  const kpis = [
    {
      label: 'Ingresos de hoy',
      value: formatCurrency(paidToday, store.currency),
      hint: `${paidTodayCount} cobro(s) registrado(s)`,
      icon: TrendingUp,
      tile: 'bg-emerald-50 text-emerald-600',
      tab: 'finance',
    },
    {
      label: 'Pacientes en agenda',
      value: String(todayAppts.length),
      hint: `${todayAppts.filter((a) => a.status === 'checked_in').length} en espera · ${
        todayAppts.filter((a) => a.status === 'completed').length
      } finalizados`,
      icon: Calendar,
      tile: 'bg-teal-50 text-teal-700',
      tab: 'agenda',
    },
    {
      label: 'Ocupación 24h',
      value: `${activeHosp.length}/${boxCodes.length}`,
      hint: `${occupancy}% de boxes en uso`,
      icon: Activity,
      tile: 'bg-rose-50 text-rose-600',
      tab: 'hospital',
    },
    {
      label: 'Cuentas pendientes',
      value: formatCurrency(receivable + fiadoTotal, store.currency),
      hint: `${formatCurrency(payable, store.currency)} por pagar`,
      icon: CreditCard,
      tile: 'bg-amber-50 text-amber-700',
      tab: 'finance',
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Hero do gestor */}
      <section className="hero-card relative overflow-hidden rounded-2xl p-5 sm:p-7 text-white">
        <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute -right-2 -top-4 h-24 w-24 rounded-full border border-white/10" />
        <PawPrint className="pointer-events-none absolute right-6 bottom-4 w-24 h-24 text-white/[0.07]" />

        <div className="relative flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_0_4px_rgba(110,231,183,0.18)]" />
              Sistema en línea
              <span className="text-white/35">·</span>
              <span className="normal-case tracking-normal font-medium text-white/70">{store.city}</span>
            </div>
            <h1 className="mt-2.5 text-2xl sm:text-[28px] font-bold tracking-tight">
              {greetingFor(now.getHours())}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p className="mt-1 text-sm text-white/75 max-w-xl">
              {new Intl.DateTimeFormat('es-PY', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)} ·{' '}
              {todayAppts.length} turno(s), {activeHosp.length} internado(s) y {alertVaccines.length} vacuna(s) por
              controlar.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pets[0]) onOpenRecord(pets[0].id);
                }}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white text-teal-800 hover:bg-white/90 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                {t.dashboard.newConsult}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('patients')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl glass-chip hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {t.dashboard.newTutorPet}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('pos')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl glass-chip hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                {t.dashboard.goPos}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full xl:w-[390px] shrink-0">
            {[
              { label: 'Turnos hoy', value: String(todayAppts.length) },
              { label: 'Internados', value: String(activeHosp.length) },
              { label: 'Caja hoy', value: formatCurrency(paidToday, store.currency) },
            ].map((item) => (
              <div key={item.label} className="glass-chip rounded-xl px-2.5 sm:px-3 py-2.5 min-w-0">
                <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.06em] text-white/65 leading-tight">
                  {item.label}
                </div>
                <div
                  className="mt-1 text-[13px] sm:text-base font-bold font-mono-tabular truncate"
                  title={item.value}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Central de alertas */}
      <section>
        <div className="flex items-end justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Central de alertas</h2>
            <p className="text-xs text-slate-500 mt-0.5">Lo que necesita la atención del gestor ahora.</p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Atualizado {formatTimeOnly(now.toISOString(), lang)}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {alerts.map((alert) => {
            const Icon = alert.icon;
            const tone = toneStyles[alert.tone];
            return (
              <button
                key={alert.id}
                type="button"
                onClick={() => onNavigate(alert.tab)}
                className={`surface-card surface-card-hover text-left p-3.5 ring-1 ${tone.ring} min-w-0`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`icon-tile ${tone.tile}`}>
                    <Icon />
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 mt-1" />
                </div>
                <div className={`mt-2.5 text-xl font-bold font-mono-tabular ${tone.value}`}>{alert.value}</div>
                <div className="text-[11px] font-semibold text-slate-700 leading-tight mt-0.5">{alert.label}</div>
                <div className="text-[10px] text-slate-500 leading-tight mt-0.5 truncate" title={alert.detail}>
                  {alert.detail}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.tab)}
              className="surface-card surface-card-hover text-left p-4 min-w-0"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-500 leading-tight">{kpi.label}</span>
                <span className={`icon-tile ${kpi.tile}`}>
                  <Icon />
                </span>
              </div>
              <div className="mt-2 text-xl sm:text-2xl font-bold text-slate-900 font-mono-tabular whitespace-nowrap">
                {kpi.value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 leading-snug">{kpi.hint}</div>
            </button>
          );
        })}
      </section>

      {/* Agenda + financeiro */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 surface-card overflow-hidden">
          <div className="section-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-tile bg-teal-50 text-teal-700">
                <Calendar />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Agenda de hoy</h2>
                <p className="text-[11px] text-slate-500">
                  {todayAppts.length} turno(s) · {todayAppts.filter((a) => a.status === 'checked_in').length} en espera
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('agenda')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Ver agenda <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {todayAppts.length === 0 ? (
              <div className="p-8 text-center">
                <Calendar className="w-7 h-7 text-slate-300 mx-auto" />
                <p className="mt-2 text-sm text-slate-500">Sin turnos para hoy.</p>
              </div>
            ) : (
              todayAppts.slice(0, 6).map((a) => {
                const pet = pets.find((p) => p.id === a.pet_id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpenRecord(a.pet_id)}
                    className="w-full px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-slate-50/80 transition-colors text-left"
                  >
                    <div className="w-11 shrink-0 text-center rounded-lg bg-slate-50 border border-slate-100 py-1">
                      <div className="text-[11px] font-bold text-slate-800 font-mono-tabular">
                        {formatTimeOnly(a.start_time, lang).replace(' a. m.', '').replace(' p. m.', '')}
                      </div>
                      <div className="text-[9px] uppercase text-slate-400">
                        {Number(a.start_time.slice(11, 13)) >= 12 ? 'pm' : 'am'}
                      </div>
                    </div>
                    <PetPhoto src={pet?.photo_url} name={a.pet_name || 'Pet'} className="w-9 h-9 rounded-xl hidden sm:block" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 truncate">{a.pet_name}</span>
                        {pet?.allergies && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                        <span
                          className={`ml-auto sm:hidden text-[9px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${statusChip[a.status]}`}
                        >
                          {t.agenda.statuses[a.status]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {a.tutor_name} · {lang === 'pt-BR' ? a.service_name_pt : a.service_name_es || a.type}
                      </div>
                    </div>
                    <span
                      className={`hidden sm:inline-flex text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${statusChip[a.status]}`}
                    >
                      {t.agenda.statuses[a.status]}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="xl:col-span-5 surface-card overflow-hidden">
          <div className="section-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-tile bg-emerald-50 text-emerald-600">
                <Wallet />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Resumen financiero</h2>
                <p className="text-[11px] text-slate-500">Facturado en {new Intl.DateTimeFormat('es-PY', { month: 'long' }).format(now)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('finance')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Finanzas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-4">
              <div className="text-[11px] font-medium text-emerald-800">Facturación del mes</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700 font-mono-tabular">
                {formatCurrency(monthRevenue, store.currency)}
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-emerald-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Math.max(6, (paidToday / Math.max(1, monthRevenue)) * 100))}%` }} />
              </div>
              <div className="mt-1.5 text-[10px] text-emerald-800/80">
                {formatCurrency(paidToday, store.currency)} cobrados hoy
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Por cobrar', value: receivable + fiadoTotal, tone: 'text-amber-700', bg: 'bg-amber-50 border-amber-100' },
                { label: 'Por pagar', value: payable, tone: 'text-rose-600', bg: 'bg-rose-50 border-rose-100' },
                { label: 'Comisiones', value: commissions, tone: 'text-teal-800', bg: 'bg-teal-50 border-teal-100' },
                { label: 'Ticket promedio', value: ticketAvg, tone: 'text-slate-800', bg: 'bg-slate-50 border-slate-100' },
              ].map((row) => (
                <div key={row.label} className={`rounded-xl border p-3 ${row.bg}`}>
                  <div className="text-[10px] font-medium text-slate-500">{row.label}</div>
                  <div className={`mt-0.5 text-sm font-bold font-mono-tabular ${row.tone} truncate`}>
                    {formatCurrency(row.value, store.currency)}
                  </div>
                </div>
              ))}
            </div>

            {consolidated.length > 1 && (
              <div className="pt-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
                  Por sucursal
                </div>
                <div className="space-y-1">
                  {consolidated.map((u) => (
                    <div key={u.store_id} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="text-slate-600 truncate">{u.name}</span>
                      <span className="font-mono-tabular font-semibold text-slate-900 shrink-0">
                        {formatCurrency(u.paid_revenue, u.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Internação + vacinas */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-7 surface-card overflow-hidden">
          <div className="section-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-tile bg-rose-50 text-rose-600">
                <Hospital />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Internación 24h</h2>
                <p className="text-[11px] text-slate-500">
                  {activeHosp.length} de {boxCodes.length} boxes · {overdueHospTasks} tarea(s) atrasada(s)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('hospital')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Mapa <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                <span>Ocupación de boxes</span>
                <span className="font-semibold text-slate-700">{occupancy}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600" style={{ width: `${Math.max(4, occupancy)}%` }} />
              </div>
            </div>

            {activeHosp.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">
                No hay pacientes internados.
              </div>
            ) : (
              <div className="space-y-2">
                {activeHosp.map((h) => {
                  const overdue = h.tasks.filter(
                    (tk) => tk.status === 'pending' && new Date(tk.scheduled_time).getTime() < Date.now(),
                  ).length;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => onNavigate('hospital')}
                      className="w-full text-left rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-slate-50 p-3 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {h.box_code} · {h.pet_name}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            overdue ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {overdue ? `${overdue} atrasada(s)` : 'Al día'}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 line-clamp-1">{h.care_plan}</div>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                        <span>{h.tutor_name}</span>
                        <span>·</span>
                        <span>{h.attending_vet}</span>
                        <span>·</span>
                        <span className={`font-semibold ${h.risk_level === 'critical' ? 'text-rose-600' : h.risk_level === 'moderate' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          Riesgo {h.risk_level}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {readyGrooming.length > 0 && (
              <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-teal-800 inline-flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5" /> Estética lista para entrega
                  </span>
                  <button type="button" onClick={() => onNavigate('grooming')} className="text-[11px] font-semibold text-teal-700">
                    Abrir kanban
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-teal-900/80 truncate">
                  {readyGrooming.map((g) => `${g.pet_name} (${g.tutor_name})`).join(' · ')}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="xl:col-span-5 surface-card overflow-hidden">
          <div className="section-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-tile bg-amber-50 text-amber-700">
                <Syringe />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Vacunas por controlar</h2>
                <p className="text-[11px] text-slate-500">
                  {overdueVaccines.length} vencida(s) · {alertVaccines.length - overdueVaccines.length} próxima(s)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('vaccines')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Buscar <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {alertVaccines.slice(0, 4).map((v) => {
              const isOverdue = v.next_due_date < todayStr;
              const waText = t.vaccines.waVaccineMsg
                .replace('{tutor}', v.tutor_name || '')
                .replace('{clinic}', store.name)
                .replace('{pet}', v.pet_name || '')
                .replace('{vaccine}', v.vaccine_name)
                .replace('{date}', formatDateShort(v.next_due_date, lang));
              return (
                <div key={v.id} className="p-3.5 flex items-center gap-3">
                  <span
                    className={`w-1.5 h-9 rounded-full shrink-0 ${isOverdue ? 'bg-rose-500' : 'bg-amber-400'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {v.pet_name} · {v.vaccine_name}
                    </div>
                    <div className={`text-[11px] font-medium ${isOverdue ? 'text-rose-600' : 'text-amber-700'}`}>
                      {isOverdue ? t.vaccines.overdue : t.vaccines.dueSoon} · {formatDateShort(v.next_due_date, lang)}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">{v.tutor_name}</div>
                  </div>
                  <a
                    href={buildWhatsAppLink(v.tutor_phone || store.whatsapp, waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[32px] w-9 h-9 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center shrink-0"
                    title="Avisar por WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-teal-700" />
                  </a>
                </div>
              );
            })}
            {alertVaccines.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">Todas las vacunas están al día.</div>
            )}
          </div>

          {allergyPets.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-rose-50/50">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3" /> Alergias registradas ({allergyPets.length})
              </div>
              <div className="mt-1 text-[11px] text-rose-900/80 line-clamp-2">
                {allergyPets.map((p) => p.name).join(' · ')}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Estoque + atividade */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-6 surface-card overflow-hidden">
          <div className="section-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-tile bg-amber-50 text-amber-700">
                <Package />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Stock crítico</h2>
                <p className="text-[11px] text-slate-500">{lowStock.length} producto(s) en o bajo el mínimo</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Inventario <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {lowStock.slice(0, 4).map((p) => (
              <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate">{p.name_es}</div>
                  <div className="text-[10px] text-slate-500 font-mono-tabular">
                    {p.sku} · mínimo {p.min_stock} {p.unit}
                  </div>
                </div>
                <span className="text-xs font-bold font-mono-tabular text-rose-600 shrink-0">
                  {p.stock_qty} {p.unit}
                </span>
              </div>
            ))}
            {lowStock.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 inline-flex w-full items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Inventario saludable.
              </div>
            )}
          </div>
        </section>

        <section className="xl:col-span-6 surface-card overflow-hidden">
          <div className="section-head">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="icon-tile bg-slate-100 text-slate-600">
                <Users />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-slate-900">Actividad reciente</h2>
                <p className="text-[11px] text-slate-500">Últimos movimientos registrados</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('audit')}
              className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1 whitespace-nowrap"
            >
              Auditoría <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="px-4 py-2.5 flex items-start gap-2.5">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-slate-800 truncate">
                    {auditLabel(log.action)}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {log.user_name} · {log.entity_type} #{log.entity_id}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                  {formatDateShort(log.created_at, lang)}
                </span>
              </div>
            ))}
            {auditLogs.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">Sin movimientos recientes.</div>
            )}
          </div>
        </section>
      </div>

      <footer className="flex flex-col sm:flex-row items-center justify-between gap-1.5 px-1 pt-1 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
          Datos de ejemplo · {store.name}
        </span>
        <span>Actualizado a las {formatTimeOnly(new Date().toISOString(), lang)}</span>
      </footer>
    </div>
  );
}
