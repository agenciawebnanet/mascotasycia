import React, { useMemo, useState } from 'react';
import { AlertTriangle, Package, Search } from 'lucide-react';
import type { AppLanguage, PetPackage, Product, ProductCategory, ServiceItem, Store } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatCurrency, formatDateShort } from '../shared/currency';

interface Props {
  store: Store;
  lang: AppLanguage;
  products: Product[];
  services: ServiceItem[];
  packages: PetPackage[];
}

const CATEGORIES: ProductCategory[] = [
  'alimentos',
  'medicamentos',
  'higiene',
  'juguetes',
  'accesorios',
  'farmacia',
];

export function InventoryView({ store, lang, products, services, packages }: Props) {
  const t = getTranslations(lang);
  const [tab, setTab] = useState<'products' | 'services' | 'packages'>('products');
  const [catFilter, setCatFilter] = useState<ProductCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (catFilter !== 'all' && p.category !== catFilter) return false;
      if (!q) return true;
      return (
        p.name_es.toLowerCase().includes(q) ||
        p.name_pt.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, catFilter, query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.inventory.title}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{t.inventory.subtitle}</p>
      </div>

      {/* Sub-tabs */}
      <div className="grid w-full grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg sm:inline-flex sm:w-fit">
        {(
          [
            ['products', t.inventory.productsTab, t.inventory.productsShort, products.length],
            ['services', t.inventory.servicesTab, t.inventory.servicesShort, services.length],
            ['packages', t.inventory.packagesTab, t.inventory.packagesShort, packages.length],
          ] as const
        ).map(([k, lbl, short, count]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-2 sm:px-3.5 py-2 rounded-md text-[11px] sm:text-xs font-medium leading-tight transition-colors text-center ${
              tab === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <span className="sm:hidden">
              {short} ({count})
            </span>
            <span className="hidden sm:inline">
              {lbl} ({count})
            </span>
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.pos.barcodePlaceholder}
                className="w-full h-10 pl-10 pr-3 bg-white border border-slate-200 rounded-xl text-sm"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value as any)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm"
            >
              <option value="all">{t.inventory.allCategories}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t.inventory.categories[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">SKU / Producto</th>
                  <th className="py-3 px-4">Categoría</th>
                  <th className="py-3 px-4">{t.inventory.batch} / {t.inventory.expiry}</th>
                  <th className="py-3 px-4 text-right">{t.inventory.stock}</th>
                  <th className="py-3 px-4 text-right">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((p) => {
                  const low = p.stock_qty <= p.min_stock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">
                          {lang === 'pt-BR' ? p.name_pt : p.name_es}
                        </div>
                        <div className="text-xs text-slate-500 font-mono-tabular">
                          {p.sku} · {p.barcode}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">{t.inventory.categories[p.category]}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 font-mono-tabular">
                        {p.batch_code || '—'} · {formatDateShort(p.expiry_date, lang)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        <span className={low ? 'text-red-700 font-bold inline-flex items-center gap-1' : 'text-slate-900 font-medium'}>
                          {low && <AlertTriangle className="w-3.5 h-3.5" />}
                          {p.stock_qty} {p.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-slate-900">
                        {formatCurrency(p.price, store.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: product cards */}
          <div className="md:hidden space-y-2.5">
            {filteredProducts.map((p) => {
              const low = p.stock_qty <= p.min_stock;
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-slate-900 leading-snug">
                        {lang === 'pt-BR' ? p.name_pt : p.name_es}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono-tabular mt-0.5 truncate">
                        {p.sku} · {p.barcode}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono-tabular font-bold text-sm text-slate-900">
                        {formatCurrency(p.price, store.currency)}
                      </div>
                      <div className={`text-[11px] font-semibold mt-0.5 ${low ? 'text-red-700' : 'text-slate-600'}`}>
                        {low && <AlertTriangle className="w-3 h-3 inline -mt-0.5 mr-1" />}
                        {p.stock_qty} {p.unit}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {t.inventory.categories[p.category]}
                    </span>
                    <span className="font-mono-tabular">
                      {p.batch_code || '—'} · {formatDateShort(p.expiry_date, lang)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'services' && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {services.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900">{lang === 'pt-BR' ? s.name_pt : s.name_es}</div>
                <div className="text-xs text-slate-500 font-mono-tabular">{s.duration_min} min</div>
              </div>
              <div className="text-sm font-mono-tabular font-bold text-teal-800">
                {formatCurrency(s.price, store.currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'packages' && (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {packages.map((pk) => (
            <div key={pk.id} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-teal-700" />
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {lang === 'pt-BR' ? pk.name_pt : pk.name_es}
                  </div>
                  <div className="text-xs text-slate-500">
                    {pk.pet_name} ({pk.tutor_name}) · {lang === 'pt-BR' ? 'Validade' : 'Vence'}:{' '}
                    {formatDateShort(pk.expires_at, lang)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-mono-tabular font-bold text-teal-800">
                  {pk.used_sessions} / {pk.total_sessions}
                </div>
                <div className="text-xs font-mono-tabular text-slate-500">
                  {formatCurrency(pk.price, store.currency)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
