import React, { useState } from 'react';
import { Check, Shield, Upload, X } from 'lucide-react';
import type { AppLanguage, AuditLog, StaffUser, Store } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatDateTime } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { ClinicLogo } from './ClinicLogo';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  staff: StaffUser[];
  auditLogs: AuditLog[];
  onRefresh: () => Promise<void>;
}

export function SettingsView({ ctx, store, lang, staff, auditLogs, onRefresh }: Props) {
  const t = getTranslations(lang);
  const [form, setForm] = useState({
    name: store.name,
    city: store.city,
    currency: store.currency,
    default_lang: store.default_lang,
    fiscal_mode: store.fiscal_mode,
    whatsapp: store.whatsapp,
    address: store.address,
    tax_id: store.tax_id,
    accent_color: store.accent_color,
    logo_url: store.logo_url || '',
    hours_clinic: store.hours_clinic,
    hours_grooming: store.hours_grooming,
  });
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, logo_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    try {
      await apiFetch(`/api/stores/${store.id}`, ctx, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      await onRefresh();
      setSavedMsg(lang === 'pt-BR' ? 'Configuração salva com sucesso!' : '¡Configuración guardada con éxito!');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.settings.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t.settings.subtitle}</p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {savedMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{savedMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Store config form */}
        <form onSubmit={handleSave} className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">{t.settings.storeSettings}</h2>
            <ClinicLogo store={{ ...store, ...form, logo_url: form.logo_url || null }} size="md" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {lang === 'pt-BR' ? 'Nome da loja' : 'Nombre de la tienda'}
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                {lang === 'pt-BR' ? 'Cidade / País' : 'Ciudad / País'}
              </label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.settings.currencyLabel}</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as any })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="PYG">PYG (G$)</option>
                <option value="BRL">BRL (R$)</option>
                <option value="ARS">ARS ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.langLabel}</label>
              <select
                value={form.default_lang}
                onChange={(e) => setForm({ ...form, default_lang: e.target.value as any })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="es">Español</option>
                <option value="pt-BR">Português (BR)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t.settings.fiscalMode}</label>
              <select
                value={form.fiscal_mode}
                onChange={(e) => setForm({ ...form, fiscal_mode: e.target.value as any })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="PY_DOC_READY">Paraguay (Comprobante / RUC)</option>
                <option value="BR_NFCE_NFSE">Brasil (NFC-e / NFS-e)</option>
                <option value="AR_AFIP_READY">Argentina (CUIT)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{store.tax_id_label}</label>
              <input
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t.settings.uploadLogo}</label>
            <label className="inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 cursor-pointer">
              <Upload className="w-4 h-4 text-teal-700" />
              <span>{t.settings.uploadLogo}</span>
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={ctx.role !== 'manager'}
              className="min-h-[42px] px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium disabled:opacity-40"
            >
              {t.settings.saveStore}
            </button>
          </div>
          {ctx.role !== 'manager' && (
            <p className="text-[11px] text-amber-700">
              {lang === 'pt-BR'
                ? 'Troque o perfil ativo para "Gestor(a)" no topo para editar a loja.'
                : 'Cambie el perfil activo a "Gestor/a" arriba para editar la tienda.'}
            </p>
          )}
        </form>

        {/* Staff & Permissions */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-sm text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4 text-teal-700" />
            <span>{t.settings.staffTitle}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {staff.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between gap-2 text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {u.specialty || u.role} {u.crmv_or_reg ? `· ${u.crmv_or_reg}` : ''}
                  </div>
                </div>
                <span className="text-xs font-medium text-teal-800 shrink-0">{t.roles[u.role]}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Audit Trail */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 font-bold text-sm text-slate-900">
          {t.settings.auditTitle}
        </div>
        <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
          {auditLogs.map((log) => (
            <div key={log.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-mono-tabular font-semibold text-slate-900 mr-2">{log.action}</span>
                <span className="text-slate-700">
                  {log.user_name} ({t.roles[log.user_role as keyof typeof t.roles] || log.user_role}) ·{' '}
                  {log.entity_type} #{log.entity_id}
                </span>
              </div>
              <span className="font-mono-tabular text-slate-500 shrink-0">{formatDateTime(log.created_at, lang)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
