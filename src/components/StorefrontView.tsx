import React, { useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, MessageCircle, Plus, ShoppingCart } from 'lucide-react';
import type { AppLanguage, Product, ProductCategory, ServiceItem, Store } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { buildWhatsAppLink, formatCurrency } from '../shared/currency';
import { ClinicLogo } from './ClinicLogo';

interface Props {
  store: Store;
  lang: AppLanguage;
  services: ServiceItem[];
  products: Product[];
  onGoToPortal: () => void;
}

export function StorefrontView({ store, lang, services, products, onGoToPortal }: Props) {
  const t = getTranslations(lang);
  const [cat, setCat] = useState<ProductCategory | 'all'>('all');
  const [cart, setCart] = useState<Record<number, number>>({});

  const visibleProducts = useMemo(
    () => (cat === 'all' ? products : products.filter((p) => p.category === cat)),
    [products, cat],
  );

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, qty]) => ({
          product: products.find((p) => p.id === Number(id))!,
          qty,
        }))
        .filter((x) => Boolean(x.product)),
    [cart, products],
  );

  const cartTotal = cartItems.reduce((sum, x) => sum + x.product.price * x.qty, 0);

  const waOrderText = useMemo(() => {
    const lines = cartItems.map(
      (x) => `• ${x.qty}x ${lang === 'pt-BR' ? x.product.name_pt : x.product.name_es} (${formatCurrency(x.product.price * x.qty, store.currency)})`,
    );
    const intro =
      lang === 'pt-BR'
        ? `Olá ${store.name}! Gostaria de fazer um pedido pela página pública:`
        : `¡Hola ${store.name}! Quiero hacer un pedido desde la tienda online:`;
    return `${intro}\n${lines.join('\n')}\nTotal: ${formatCurrency(cartTotal, store.currency)}`;
  }, [cartItems, cartTotal, lang, store.currency, store.name]);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <ClinicLogo store={store} size="md" />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight text-balance">
                  {store.name}
                </h1>
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                  <span>{store.city}</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xl">{t.storefront.subtitle}</p>
            <div className="text-xs text-slate-600 space-y-1 pt-1">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>
                  <strong>Clínica:</strong> {store.hours_clinic}
                </span>
              </div>
              <div className="pl-5">
                <strong>{lang === 'pt-BR' ? 'Banho e Tosa' : 'Baño y Tosa'}:</strong> {store.hours_grooming}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onGoToPortal}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Calendar className="w-4 h-4" />
              {t.storefront.bookNow}
            </button>
            <a
              href={buildWhatsAppLink(
                store.whatsapp,
                lang === 'pt-BR' ? `Olá ${store.name}, gostaria de atendimento!` : `¡Hola ${store.name}, quisiera consultar por un turno!`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 text-teal-700" />
              {t.storefront.orderWhatsApp}
            </a>
          </div>
        </div>

        <div className="lg:col-span-6 min-h-[220px] lg:min-h-[300px] bg-slate-100">
          <img
            src="/src/assets/images/clinic_hero_mascotas_1795016851759.jpg"
            alt={store.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Services Menu */}
      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">{t.storefront.servicesSection}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {services.map((s) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{lang === 'pt-BR' ? s.name_pt : s.name_es}</div>
                <div className="text-xs text-slate-500 font-mono-tabular">{s.duration_min} min</div>
              </div>
              <div className="text-sm font-mono-tabular font-bold text-teal-800 shrink-0">
                {formatCurrency(s.price, store.currency)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Storefront Catalog + WhatsApp Cart */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">{t.storefront.catalogSection}</h2>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setCat('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                cat === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.inventory.allCategories}
            </button>
            {(Object.keys(t.inventory.categories) as ProductCategory[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  cat === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t.inventory.categories[c]}
              </button>
            ))}
          </div>
        </div>

        {cartItems.length > 0 && (
          <div className="bg-teal-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm">
              <ShoppingCart className="w-4 h-4 text-teal-300" />
              <span>
                {cartItems.reduce((s, x) => s + x.qty, 0)} item(s) ·{' '}
                <strong className="font-mono-tabular">{formatCurrency(cartTotal, store.currency)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCart({})}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs"
              >
                {lang === 'pt-BR' ? 'Limpar' : 'Limpiar'}
              </button>
              <a
                href={buildWhatsAppLink(store.whatsapp, waOrderText)}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-white text-teal-900 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                {t.storefront.sendCartWhatsApp}
              </a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProducts.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="text-[11px] text-slate-500">{t.inventory.categories[p.category]}</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {lang === 'pt-BR' ? p.name_pt : p.name_es}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
                  {p.unit} · {t.inventory.stock}: {p.stock_qty}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-base font-mono-tabular font-bold text-teal-800">
                  {formatCurrency(p.price, store.currency)}
                </span>
                <button
                  type="button"
                  disabled={p.stock_qty <= 0}
                  onClick={() => setCart((prev) => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.storefront.addToOrder}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
