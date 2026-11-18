import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  FileText,
  Hospital,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Package,
  PawPrint,
  RotateCcw,
  Scissors,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store as StoreIcon,
  Syringe,
  TrendingUp,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  AppLanguage,
  AppMode,
  Appointment,
  AuditLog,
  Comanda,
  FinancialEntry,
  GroomingOrder,
  Hospitalization,
  Pet,
  PetPackage,
  Product,
  ServiceItem,
  StaffUser,
  Store,
  SurgeryRecord,
  Tutor,
  VaccineRecord,
} from './shared/types';
import { getTranslations } from './shared/i18n';
import { buildWhatsAppLink } from './shared/currency';
import { apiFetch, type ApiSessionContext } from './lib/api';

// Views are code-split so the first paint only loads the dashboard.
const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const PatientsView = lazy(() => import('./components/PatientsView').then((m) => ({ default: m.PatientsView })));
const PetProfileView = lazy(() => import('./components/PetProfileView').then((m) => ({ default: m.PetProfileView })));
const RecordView = lazy(() => import('./components/RecordView').then((m) => ({ default: m.RecordView })));
const VaccinesView = lazy(() => import('./components/VaccinesView').then((m) => ({ default: m.VaccinesView })));
const AgendaView = lazy(() => import('./components/AgendaView').then((m) => ({ default: m.AgendaView })));
const GroomingView = lazy(() => import('./components/GroomingView').then((m) => ({ default: m.GroomingView })));
const HospitalView = lazy(() => import('./components/HospitalView').then((m) => ({ default: m.HospitalView })));
const PosView = lazy(() => import('./components/PosView').then((m) => ({ default: m.PosView })));
const InventoryView = lazy(() => import('./components/InventoryView').then((m) => ({ default: m.InventoryView })));
const FinanceView = lazy(() => import('./components/FinanceView').then((m) => ({ default: m.FinanceView })));
const PortalView = lazy(() => import('./components/PortalView').then((m) => ({ default: m.PortalView })));
const StorefrontView = lazy(() => import('./components/StorefrontView').then((m) => ({ default: m.StorefrontView })));
const SettingsView = lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));
const AuditView = lazy(() => import('./components/AuditView').then((m) => ({ default: m.AuditView })));

interface BootstrapPayload {
  mode: AppMode;
  stores: Store[];
  activeStore: Store;
  staff: StaffUser[];
  tutors: Tutor[];
  pets: Pet[];
  services: ServiceItem[];
  products: Product[];
  packages: PetPackage[];
}

export default function App() {
  const [mode] = useState<AppMode>('demo');
  const [lang] = useState<AppLanguage>('es');
  const [role, setRole] = useState<ApiSessionContext['role']>('vet');
  const [storeId, setStoreId] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const tab = new URLSearchParams(window.location.search).get('tab');
    const allowed = [
      'dashboard',
      'patients',
      'pet',
      'agenda',
      'record',
      'vaccines',
      'grooming',
      'hospital',
      'pos',
      'inventory',
      'finance',
      'portal',
      'storefront',
      'audit',
      'settings',
    ];
    return tab && allowed.includes(tab) ? tab : 'dashboard';
  });
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const [bootstrap, setBootstrap] = useState<BootstrapPayload | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [grooming, setGrooming] = useState<GroomingOrder[]>([]);
  const [hospitalizations, setHospitalizations] = useState<Hospitalization[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryRecord[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [financeEntries, setFinanceEntries] = useState<FinancialEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [consolidated, setConsolidated] = useState<any[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const t = getTranslations(lang);

  const activeUser = useMemo(() => {
    const staff = bootstrap?.staff || [];
    return staff.find((s) => s.role === role) || staff[0];
  }, [bootstrap?.staff, role]);

  const ctx: ApiSessionContext = useMemo(
    () => ({
      mode,
      lang,
      role,
      userName: activeUser?.name || t.roles[role],
      userId: activeUser?.id ?? null,
      storeId,
    }),
    [mode, lang, role, activeUser, storeId, t.roles],
  );

  const loadAll = useCallback(async () => {
    try {
      setLoadError(null);
      const boot = await apiFetch<BootstrapPayload>('/api/bootstrap', ctx);
      setBootstrap(boot);
      if (boot.activeStore && boot.activeStore.id !== storeId) {
        setStoreId(boot.activeStore.id);
      }
      setSelectedPetId((prev) => {
        if (prev && boot.pets.some((p) => p.id === prev)) return prev;
        return boot.pets[0]?.id ?? null;
      });

      const [appts, vacs, grooms, hospData, cmds, finData, consData] = await Promise.all([
        apiFetch<Appointment[]>('/api/appointments', ctx),
        apiFetch<VaccineRecord[]>('/api/vaccines', ctx),
        apiFetch<GroomingOrder[]>('/api/grooming', ctx),
        apiFetch<{ hospitalizations: Hospitalization[]; surgeries: SurgeryRecord[] }>('/api/hospitalizations', ctx),
        apiFetch<Comanda[]>('/api/comandas', ctx),
        apiFetch<{ entries: FinancialEntry[]; auditLogs: AuditLog[] }>('/api/finance', ctx),
        apiFetch<any[]>('/api/consolidated', ctx),
      ]);

      setAppointments(appts);
      setVaccines(vacs);
      setGrooming(grooms);
      setHospitalizations(hospData.hospitalizations);
      setSurgeries(hospData.surgeries);
      setComandas(cmds);
      setFinanceEntries(finData.entries);
      setAuditLogs(finData.auditLogs);
      setConsolidated(consData);
    } catch (err: any) {
      setLoadError(err.message);
    }
  }, [ctx, storeId]);

  useEffect(() => {
    loadAll();
  }, [mode, storeId]);

  async function handleResetDemo() {
    setResetting(true);
    try {
      await fetch('/api/demo/reset', { method: 'POST' });
      setStoreId(1);
      setActiveTab('dashboard');
      await loadAll();
    } finally {
      setResetting(false);
    }
  }

  function handleOpenRecord(petId: number) {
    setSelectedPetId(petId);
    setActiveTab('record');
    setMobileMenuOpen(false);
  }

  function handleNavigate(tab: string) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  }

  const navGroups = useMemo<Array<{ label: string; items: Array<{ id: string; label: string; icon: LucideIcon }> }>>(
    () => [
      {
        label: 'Clínica',
        items: [
          { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
          { id: 'agenda', label: t.nav.agenda, icon: Calendar },
          { id: 'patients', label: t.nav.patients, icon: Users },
          { id: 'pet', label: t.nav.pet, icon: PawPrint },
          { id: 'record', label: t.nav.record, icon: FileText },
          { id: 'vaccines', label: t.nav.vaccines, icon: Syringe },
        ],
      },
      {
        label: 'Servicios',
        items: [
          { id: 'grooming', label: t.nav.grooming, icon: Scissors },
          { id: 'hospital', label: t.nav.hospital, icon: Hospital },
          { id: 'pos', label: t.nav.pos, icon: ShoppingBag },
          { id: 'inventory', label: t.nav.inventory, icon: Package },
        ],
      },
      {
        label: 'Gestión',
        items: [
          { id: 'finance', label: t.nav.finance, icon: TrendingUp },
          { id: 'portal', label: t.nav.portal, icon: UserCheck },
          { id: 'storefront', label: t.nav.storefront, icon: StoreIcon },
          { id: 'audit', label: t.nav.audit, icon: ShieldCheck },
          { id: 'settings', label: t.nav.settings, icon: Settings },
        ],
      },
    ],
    [t.nav],
  );

  const navItems = useMemo(() => navGroups.flatMap((g) => g.items), [navGroups]);
  const supportWaHref = buildWhatsAppLink(bootstrap?.activeStore?.whatsapp || '+59561500123', t.wantSystemMsg);

  if (!bootstrap && !loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="relative inline-flex">
            <img
              src="/logo.png"
              alt="Mascotas y Cia"
              className="w-16 h-16 object-contain bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="mt-3 font-display font-bold text-slate-900">{t.brand}</div>
          <div className="text-xs text-slate-500">{t.systemSubtitle}</div>
          <div className="mt-4 h-1 w-32 mx-auto rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full w-1/2 rounded-full bg-teal-700 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const activeStore = bootstrap?.activeStore;
  const activeName = (activeUser?.name || t.roles[role]).replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const activeInitials =
    (activeUser?.name || t.roles[role])
      .replace(/\s*\(.*?\)\s*/g, ' ')
      .split(/\s+/)
      .filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || 'MC';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white/95 backdrop-blur-xl border-r border-slate-200/70 z-30">
        <div className="px-5 pt-5 pb-4 flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src="/logo.png"
              alt="Mascotas y Cia"
              className="w-11 h-11 object-contain rounded-2xl bg-white p-1 ring-1 ring-slate-200 shadow-sm"
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-extrabold text-[15px] tracking-tight text-slate-900 truncate">
              Mascotas y Cia
            </div>
            <div className="text-[10.5px] text-slate-500 truncate">Sistema veterinario</div>
          </div>
        </div>

        {/* Unit & Role Selectors */}
        <div className="mx-3 mb-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 space-y-2">
          <div>
            <label className="block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1">
              {t.unitLabel}
            </label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(Number(e.target.value));
                }}
                className="w-full h-8 pl-8 pr-2 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
              >
                {bootstrap?.stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.currency})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400 mb-1">
              {t.roleLabel}
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800"
            >
              {(['vet', 'reception', 'groomer', 'manager', 'tutor'] as const).map((r) => (
                <option key={r} value={r}>
                  {t.roles[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2.5 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavigate(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-all text-left ${
                        active
                          ? 'nav-active font-semibold'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/80" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3">
          <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-3 text-[10.5px] leading-relaxed text-slate-500">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">{t.brand}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-1.5 py-0.5">
                24h
              </span>
            </div>
            <div className="mt-1 truncate">{activeStore?.address || activeStore?.city}</div>
            <div>{activeStore?.phone}</div>
            <div className="mt-1 text-slate-400">{activeStore?.hours_clinic}</div>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-72 flex flex-col min-h-screen pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        {/* Sticky Top Bar */}
        <header className="no-print sticky top-0 z-20 bg-white lg:bg-white/80 lg:backdrop-blur-xl border-b border-slate-200/70 px-3 sm:px-6">
          <div className="h-14 lg:h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Menu"
                className="lg:hidden min-h-[40px] min-w-[40px] -ml-1 rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-100"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-slate-400">
                  <span className="truncate">{t.brand}</span>
                  <span className="hidden sm:inline text-slate-300">·</span>
                  <span className="hidden sm:inline truncate normal-case tracking-normal text-slate-500">
                    {activeStore?.city}
                  </span>
                </div>
                <div className="font-display font-bold text-sm sm:text-[15px] text-slate-900 whitespace-nowrap truncate leading-tight">
                  {navItems.find((i) => i.id === activeTab)?.label || t.brand}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {mode === 'demo' && (
                <span className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Entorno demo
                </span>
              )}

              {mode === 'demo' && (
                <button
                  type="button"
                  disabled={resetting}
                  onClick={handleResetDemo}
                  title={t.resetDemo}
                  className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">{t.resetDemo}</span>
                </button>
              )}

              <a
                href={supportWaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[36px] px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors shadow-sm"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{t.wantSystem}</span>
              </a>

              <div className="hidden xl:flex items-center gap-2 pl-2.5 ml-1 border-l border-slate-200">
                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-teal-900 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white shadow-sm">
                  {activeInitials}
                </span>
                <div className="leading-tight min-w-0">
                  <div className="text-[11px] font-semibold text-slate-800 truncate max-w-[140px]">
                    {activeName}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">{t.roles[role]}</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-[1420px] w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-5">
          {loadError && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">{loadError}</div>
          )}

          <Suspense
            fallback={
              <div className="py-16 text-center text-sm text-slate-500" role="status">
                Cargando módulo…
              </div>
            }
          >
          {bootstrap && activeStore && (
            <>
              {activeTab === 'dashboard' && (
                <DashboardView
                  store={activeStore}
                  lang={lang}
                  userName={activeUser?.name}
                  role={role}
                  pets={bootstrap.pets}
                  appointments={appointments}
                  vaccines={vaccines}
                  hospitalizations={hospitalizations}
                  grooming={grooming}
                  comandas={comandas}
                  products={bootstrap.products}
                  financeEntries={financeEntries}
                  auditLogs={auditLogs}
                  consolidated={consolidated}
                  onOpenRecord={handleOpenRecord}
                  onNavigate={handleNavigate}
                />
              )}

              {activeTab === 'patients' && (
                <PatientsView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  tutors={bootstrap.tutors}
                  pets={bootstrap.pets}
                  onRefresh={loadAll}
                  onOpenRecord={handleOpenRecord}
                />
              )}

              {activeTab === 'pet' && (
                <PetProfileView
                  ctx={ctx}
                  petId={selectedPetId}
                  pets={bootstrap.pets}
                  lang={lang}
                  onSelectPet={setSelectedPetId}
                  onOpenRecord={handleOpenRecord}
                  onNavigate={handleNavigate}
                />
              )}

              {activeTab === 'record' && (
                <RecordView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  mode={mode}
                  pets={bootstrap.pets}
                  selectedPetId={selectedPetId}
                  onSelectPet={setSelectedPetId}
                  onRefreshBootstrap={loadAll}
                />
              )}

              {activeTab === 'vaccines' && (
                <VaccinesView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  mode={mode}
                  pets={bootstrap.pets}
                  vaccines={vaccines}
                  onRefresh={loadAll}
                />
              )}

              {activeTab === 'agenda' && (
                <AgendaView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  pets={bootstrap.pets}
                  staff={bootstrap.staff}
                  services={bootstrap.services}
                  appointments={appointments}
                  onRefresh={loadAll}
                />
              )}

              {activeTab === 'grooming' && (
                <GroomingView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  pets={bootstrap.pets}
                  services={bootstrap.services}
                  packages={bootstrap.packages}
                  orders={grooming}
                  onRefresh={loadAll}
                  onGoToPos={() => handleNavigate('pos')}
                />
              )}

              {activeTab === 'hospital' && (
                <HospitalView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  mode={mode}
                  pets={bootstrap.pets}
                  hospitalizations={hospitalizations}
                  surgeries={surgeries}
                  onRefresh={loadAll}
                />
              )}

              {activeTab === 'pos' && (
                <PosView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  tutors={bootstrap.tutors}
                  pets={bootstrap.pets}
                  services={bootstrap.services}
                  products={bootstrap.products}
                  comandas={comandas}
                  onRefresh={loadAll}
                />
              )}

              {activeTab === 'inventory' && (
                <InventoryView
                  store={activeStore}
                  lang={lang}
                  products={bootstrap.products}
                  services={bootstrap.services}
                  packages={bootstrap.packages}
                />
              )}

              {activeTab === 'finance' && (
                <FinanceView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  mode={mode}
                  entries={financeEntries}
                  consolidated={consolidated}
                  onRefresh={loadAll}
                />
              )}

              {activeTab === 'portal' && (
                <PortalView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  tutors={bootstrap.tutors}
                  services={bootstrap.services}
                  staff={bootstrap.staff}
                  onBooked={loadAll}
                />
              )}

              {activeTab === 'storefront' && (
                <StorefrontView
                  store={activeStore}
                  lang={lang}
                  services={bootstrap.services}
                  products={bootstrap.products}
                  onGoToPortal={() => handleNavigate('portal')}
                />
              )}

              {activeTab === 'audit' && <AuditView logs={auditLogs} lang={lang} />}

              {activeTab === 'settings' && (
                <SettingsView
                  ctx={ctx}
                  store={activeStore}
                  lang={lang}
                  staff={bootstrap.staff}
                  auditLogs={auditLogs}
                  onRefresh={loadAll}
                />
              )}
            </>
          )}
          </Suspense>
        </main>

        {/* Footer with clinic information */}
        <footer className="no-print border-t border-slate-200/70 bg-white/60 px-4 py-3.5 text-[10.5px] text-slate-500">
          <div className="max-w-[1420px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5">
            <span className="font-semibold text-slate-600">
              {t.brand} · {t.systemSubtitle}
            </span>
            <span className="text-center sm:text-right">
              {activeStore?.address} · {activeStore?.phone}
            </span>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-30 min-h-14 pb-[env(safe-area-inset-bottom)] bg-white/90 backdrop-blur-xl border-t border-slate-200/80 grid grid-cols-5 items-center">
        {[
          { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
          { id: 'record', label: 'Historia', icon: FileText },
          { id: 'vaccines', label: t.nav.vaccines, icon: Syringe },
          { id: 'pos', label: 'PDV', icon: ShoppingBag },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigate(item.id)}
              className={`h-full flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-teal-800 font-semibold' : 'text-slate-500'
              }`}
            >
              <span className={`px-3 py-1 rounded-full transition-colors ${active ? 'bg-teal-50' : ''}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-[10px] truncate max-w-[64px]">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-600"
        >
          <span className={`px-3 py-1 rounded-full ${mobileMenuOpen ? 'bg-teal-50 text-teal-800' : ''}`}>
            <Menu className="w-5 h-5" />
          </span>
          <span className="text-[10px]">Más</span>
        </button>
      </nav>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-sm flex">
          <div className="w-[290px] max-w-[86vw] bg-white h-full flex flex-col shadow-2xl">
            <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/logo.png"
                  alt="Mascotas y Cia"
                  className="w-10 h-10 object-contain rounded-xl bg-white border border-slate-200 p-0.5"
                />
                <div className="leading-tight">
                  <div className="font-display font-bold text-sm text-slate-900">{t.brand}</div>
                  <div className="text-[10px] text-slate-500">{t.systemSubtitle}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Cerrar"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50/80">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-xs"
              >
                {(['vet', 'reception', 'groomer', 'manager', 'tutor'] as const).map((r) => (
                  <option key={r} value={r}>
                    {t.roleLabel}: {t.roles[r]}
                  </option>
                ))}
              </select>
              {mode === 'demo' && (
                <button
                  type="button"
                  onClick={() => {
                    handleResetDemo();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {t.resetDemo}
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-2.5 space-y-4">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <div className="px-2 pb-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavigate(item.id)}
                          className={`w-full min-h-[42px] flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium ${
                            active ? 'nav-active font-semibold' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
