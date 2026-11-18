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
  RotateCcw,
  Scissors,
  Settings,
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  Syringe,
  TrendingUp,
  UserCheck,
  Users,
  X,
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
import { BrandMark } from './components/BrandMark';
import { ClinicLogo } from './components/ClinicLogo';

// Views are code-split so the first paint only loads the dashboard.
const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const PatientsView = lazy(() => import('./components/PatientsView').then((m) => ({ default: m.PatientsView })));
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
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIntroCard, setShowIntroCard] = useState(true);
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
      setShowIntroCard(true);
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

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: t.nav.dashboard, icon: LayoutDashboard },
      { id: 'patients', label: t.nav.patients, icon: Users },
      { id: 'agenda', label: t.nav.agenda, icon: Calendar },
      { id: 'record', label: t.nav.record, icon: FileText },
      { id: 'vaccines', label: t.nav.vaccines, icon: Syringe },
      { id: 'grooming', label: t.nav.grooming, icon: Scissors },
      { id: 'hospital', label: t.nav.hospital, icon: Hospital },
      { id: 'pos', label: t.nav.pos, icon: ShoppingBag },
      { id: 'inventory', label: t.nav.inventory, icon: Package },
      { id: 'finance', label: t.nav.finance, icon: TrendingUp },
      { id: 'portal', label: t.nav.portal, icon: UserCheck },
      { id: 'storefront', label: t.nav.storefront, icon: StoreIcon },
      { id: 'settings', label: t.nav.settings, icon: Settings },
    ],
    [t.nav],
  );

  const supportWaHref = buildWhatsAppLink('+59561500123', t.wantSystemMsg);

  if (!bootstrap && !loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="space-y-3 text-center">
          <BrandMark className="w-12 h-12 mx-auto" />
          <div className="font-display font-bold text-slate-900">{t.brand}</div>
          <div className="text-xs text-slate-500">{t.systemSubtitle}</div>
        </div>
      </div>
    );
  }

  const activeStore = bootstrap?.activeStore;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (256px) */}
      <aside className="no-print hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-slate-200">
          {activeStore ? <ClinicLogo store={activeStore} size="sm" /> : <BrandMark className="w-8 h-8" />}
          <div className="min-w-0">
            <div className="font-display font-bold text-sm text-slate-900 truncate">{t.brand}</div>
            <div className="text-[11px] text-slate-500 truncate">{activeStore?.name || t.systemSubtitle}</div>
          </div>
        </div>

        {/* Unit & Role Selectors */}
        <div className="p-3.5 border-b border-slate-100 space-y-2.5 bg-slate-50/60">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.unitLabel}</label>
            <div className="relative">
              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <select
                value={storeId}
                onChange={(e) => {
                  setStoreId(Number(e.target.value));
                }}
                className="w-full h-8 pl-8 pr-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
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
            <label className="block text-[11px] font-medium text-slate-500 mb-1">{t.roleLabel}</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full h-8 px-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
            >
              {(['vet', 'reception', 'groomer', 'manager', 'tutor'] as const).map((r) => (
                <option key={r} value={r}>
                  {t.roles[r]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                  active ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-700' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-slate-200 text-[11px] leading-relaxed text-slate-500">
          <div className="font-semibold text-slate-700">{t.brand}</div>
          <div>{activeStore?.address || activeStore?.city}</div>
          <div>{activeStore?.phone}</div>
          <div className="mt-1 text-slate-400">{activeStore?.hours_clinic}</div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-16 lg:pb-0">
        {/* Compact Sticky Top Bar (52px on mobile) */}
        <header className="no-print sticky top-0 z-20 h-13 lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Menu"
              className="lg:hidden min-h-[40px] min-w-[40px] -ml-1 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm sm:text-base text-slate-900 whitespace-nowrap truncate">
                {navItems.find((i) => i.id === activeTab)?.label || t.brand}
              </div>
              <div className="hidden sm:block text-[11px] text-slate-500 truncate">
                {activeStore?.name} · {activeStore?.city}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode === 'demo' && (
              <button
                type="button"
                disabled={resetting}
                onClick={handleResetDemo}
                title={t.resetDemo}
                className="min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t.resetDemo}</span>
              </button>
            )}

            <a
              href={supportWaHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>{t.wantSystem}</span>
            </a>
          </div>
        </header>

        {/* Scrollable Demo Notice Banner (top of every screen, non-sticky so mobile chrome stays <= 15%) */}
        {mode === 'demo' && (
          <div className="no-print bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 font-medium text-center">
            {t.demoNotice}
          </div>
        )}

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
          {/* 3-Line Demo Intro Card */}
          {mode === 'demo' && showIntroCard && (
            <div className="no-print bg-white border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t.demoIntroTitle}</span>
                </div>
                <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{t.demoIntroBody}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowIntroCard(false)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 self-start sm:self-center whitespace-nowrap shrink-0"
              >
                {t.dismiss}
              </button>
            </div>
          )}

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
                  pets={bootstrap.pets}
                  appointments={appointments}
                  vaccines={vaccines}
                  hospitalizations={hospitalizations}
                  grooming={grooming}
                  comandas={comandas}
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
        <footer className="no-print border-t border-slate-200 bg-white px-4 py-4 text-[11px] text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-slate-700">{t.brand} · {t.systemSubtitle}</span>
            <span className="text-center sm:text-right">
              {activeStore?.address} · {activeStore?.phone}
            </span>
          </div>
        </footer>
      </div>

      {/* Mobile Bottom Tab Bar (56px, thumb-friendly) */}
      <nav className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center">
        {[
          { id: 'dashboard', label: t.nav.dashboard.split(' ')[0], icon: LayoutDashboard },
          { id: 'record', label: lang === 'pt-BR' ? 'Prontuário' : 'Historia', icon: FileText },
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
                active ? 'text-teal-700 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] truncate max-w-[64px]">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-600"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px]">{lang === 'pt-BR' ? 'Mais' : 'Más'}</span>
        </button>
      </nav>

      {/* Mobile Slide-Over Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-sm flex">
          <div className="w-72 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl">
            <div className="h-14 px-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BrandMark className="w-8 h-8" />
                <div className="leading-tight">
                  <div className="font-display font-bold text-sm text-slate-900">{t.brand}</div>
                  <div className="text-[10px] text-slate-500">{t.systemSubtitle}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 border-b border-slate-100 space-y-2 bg-slate-50">
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
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.id)}
                    className={`w-full min-h-[44px] flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                      active ? 'bg-teal-50 text-teal-900 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
