import React, { useMemo, useState } from 'react';
import { Building2, Download, FileSpreadsheet, Plus, X } from 'lucide-react';
import type { AppLanguage, AppMode, FinancialEntry, Store } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatCurrency, formatDateShort } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { downloadExcelCsv, downloadFinanceReportPdf } from '../lib/pdf';

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
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  mode: AppMode;
  entries: FinancialEntry[];
  consolidated: ConsolidatedRow[];
  onRefresh: () => Promise<void>;
}

export function FinanceView({ ctx, store, lang, mode, entries, consolidated, onRefresh }: Props) {
  const t = getTranslations(lang);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: 'expense' as 'income' | 'expense',
    category: 'Operativo',
    description: '',
    amount: '',
    due_date: new Date().toISOString().slice(0, 10),
    status: 'paid' as 'paid' | 'pending',
  });

  const summary = useMemo(() => {
    const income = entries.filter((e) => e.type === 'income' && e.status === 'paid').reduce((s, e) => s + e.amount, 0);
    const expenses = entries.filter((e) => e.type === 'expense' && e.status === 'paid').reduce((s, e) => s + e.amount, 0);
    const receivable = entries.filter((e) => e.type === 'income' && e.status === 'pending').reduce((s, e) => s + e.amount, 0);
    return { income, expenses, net: income - expenses, receivable };
  }, [entries]);

  const commissions = useMemo(() => {
    const map = new Map<string, { name: string; base: number; commission: number }>();
    entries.forEach((e) => {
      if (e.type === 'income' && e.status === 'paid' && e.professional_name && e.commission_pct > 0) {
        const cur = map.get(e.professional_name) || { name: e.professional_name, base: 0, commission: 0 };
        cur.base += e.amount;
        cur.commission += (e.amount * e.commission_pct) / 100;
        map.set(e.professional_name, cur);
      }
    });
    return Array.from(map.values());
  }, [entries]);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/finance', ctx, {
        method: 'POST',
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      setShowNew(false);
      setForm((p) => ({ ...p, description: '', amount: '' }));
      await onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.finance.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.finance.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadFinanceReportPdf(entries, store, lang, mode)}
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            {t.finance.exportPdf}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadExcelCsv(
                `mascotasycia_finanzas_${store.code}.csv`,
                ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Estado', 'Monto'],
                entries.map((e) => [e.due_date, e.type, e.category, e.description, e.status, e.amount]),
              )
            }
            className="min-h-[40px] px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-teal-700" />
            {t.finance.exportExcel}
          </button>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {t.finance.newEntry}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DRE Summary 4-Column */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">{t.finance.income}</div>
          <div className="text-xl font-bold font-mono-tabular text-emerald-700 mt-1.5">
            {formatCurrency(summary.income, store.currency)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">{t.finance.expenses}</div>
          <div className="text-xl font-bold font-mono-tabular text-red-700 mt-1.5">
            {formatCurrency(summary.expenses, store.currency)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">{t.finance.netResult}</div>
          <div className="text-xl font-bold font-mono-tabular text-slate-900 mt-1.5">
            {formatCurrency(summary.net, store.currency)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">{t.finance.pendingReceivable}</div>
          <div className="text-xl font-bold font-mono-tabular text-amber-700 mt-1.5">
            {formatCurrency(summary.receivable, store.currency)}
          </div>
        </div>
      </div>

      {/* Commissions & Multi-Unit Consolidated */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 font-semibold text-sm text-slate-900">
            {t.finance.commissions}
          </div>
          <div className="divide-y divide-slate-100">
            {commissions.length === 0 ? (
              <div className="p-5 text-xs text-slate-500">—</div>
            ) : (
              commissions.map((c) => (
                <div key={c.name} className="p-4 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 font-mono-tabular">
                      Base: {formatCurrency(c.base, store.currency)}
                    </div>
                  </div>
                  <div className="font-mono-tabular font-bold text-teal-800">
                    {formatCurrency(c.commission, store.currency)}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 font-semibold text-sm text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-700" />
            <span>{lang === 'pt-BR' ? 'Consolidado Multi-Unidade' : 'Consolidado Multi-Sucursal'}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {consolidated.map((u) => (
              <div key={u.store_id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-semibold text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {u.city} · {u.pets_count} pets · {u.appointments_count} turnos
                  </div>
                </div>
                <div className="font-mono-tabular font-bold text-slate-900">
                  {formatCurrency(u.paid_revenue, u.currency)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">{lang === 'pt-BR' ? 'Data' : 'Fecha'}</th>
              <th className="py-3 px-4">{lang === 'pt-BR' ? 'Descrição' : 'Descripción'}</th>
              <th className="py-3 px-4">{lang === 'pt-BR' ? 'Categoria' : 'Categoría'}</th>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4 text-right">{lang === 'pt-BR' ? 'Valor' : 'Monto'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="py-3 px-4 text-xs font-mono-tabular text-slate-600">{formatDateShort(e.due_date, lang)}</td>
                <td className="py-3 px-4 font-medium text-slate-900">{e.description}</td>
                <td className="py-3 px-4 text-xs text-slate-600">{e.category}</td>
                <td className="py-3 px-4 text-xs text-slate-600">{e.status === 'paid' ? 'Pago' : 'Pendente'}</td>
                <td
                  className={`py-3 px-4 text-right font-mono-tabular font-bold ${
                    e.type === 'income' ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {e.type === 'income' ? '+' : '-'}
                  {formatCurrency(e.amount, store.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {showNew && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleAddEntry} className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{t.finance.newEntry}</h3>
              <button type="button" onClick={() => setShowNew(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="income">{t.finance.income}</option>
                <option value="expense">{t.finance.expenses}</option>
              </select>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="paid">{lang === 'pt-BR' ? 'Pago' : 'Pagado'}</option>
                <option value="pending">{lang === 'pt-BR' ? 'Pendente' : 'Pendiente'}</option>
              </select>
            </div>
            <input
              required
              placeholder={lang === 'pt-BR' ? 'Descrição' : 'Descripción'}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                required
                type="number"
                placeholder={lang === 'pt-BR' ? 'Valor' : 'Monto'}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
              />
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
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
