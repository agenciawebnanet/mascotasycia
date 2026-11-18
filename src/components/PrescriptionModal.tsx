import React from 'react';
import { AlertTriangle, Download, Printer, X } from 'lucide-react';
import type { AppLanguage, AppMode, Pet, Prescription, Store } from '../shared/types';
import { formatDateShort, formatWeight } from '../shared/currency';
import { getTranslations } from '../shared/i18n';
import { downloadPrescriptionPdf } from '../lib/pdf';
import { ClinicLogo } from './ClinicLogo';

interface Props {
  rx: Prescription;
  pet: Pet;
  store: Store;
  lang: AppLanguage;
  mode: AppMode;
  onClose: () => void;
}

export function PrescriptionModal({ rx, pet, store, lang, mode, onClose }: Props) {
  const t = getTranslations(lang);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden my-auto">
        {/* Action bar (hidden on print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
          <div className="text-sm font-semibold text-slate-900">
            {rx.type === 'controlled' ? t.record.rxTypeControlled : t.record.rxTypeNormal} · A4
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadPrescriptionPdf(rx, pet, store, lang, mode)}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-4 h-4" />
              {t.record.downloadPdf}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <Printer className="w-4 h-4" />
              {t.record.printBtn}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="min-h-[40px] min-w-[40px] rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 inline-flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable A4 Sheet */}
        <div className="p-6 sm:p-10 bg-white text-slate-900 space-y-6">
          {mode === 'demo' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium px-3 py-1.5 rounded-md text-center">
              Datos de ejemplo · Mascotas y Cia
            </div>
          )}

          {/* Clinic Header */}
          <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div className="flex items-center gap-3.5">
              <ClinicLogo store={store} size="lg" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">{store.name}</h2>
                <p className="text-xs text-slate-600">
                  {store.city} · {store.tax_id_label}: {store.tax_id}
                </p>
                <p className="text-xs text-slate-500">
                  {store.address} · Tel: {store.phone}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-slate-600 tabular-nums shrink-0">
              <div className="font-semibold text-teal-800">
                {rx.type === 'controlled'
                  ? lang === 'pt-BR'
                    ? 'RECEITUÁRIO CONTROLADO'
                    : 'RECETARIO CONTROLADO'
                  : lang === 'pt-BR'
                    ? 'RECEITA VETERINÁRIA'
                    : 'RECETA VETERINARIA'}
              </div>
              <div>
                {lang === 'pt-BR' ? 'Emissão' : 'Emisión'}: {formatDateShort(rx.created_at, lang)}
              </div>
              <div>
                {lang === 'pt-BR' ? 'Validade' : 'Válida hasta'}: {formatDateShort(rx.valid_until, lang)}
              </div>
            </div>
          </div>

          {/* Patient Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-base font-semibold text-slate-900">
                {pet.name} · <span className="text-slate-600 font-normal">{pet.breed}</span>
              </div>
              <div className="text-sm font-mono-tabular font-semibold text-slate-800">
                {formatWeight(pet.weight_kg, lang)}
              </div>
            </div>
            <div className="text-xs text-slate-600">
              Tutor: <strong className="text-slate-800">{pet.tutor_name}</strong> · Tel: {pet.tutor_phone} · Microchip: {pet.microchip || '—'}
            </div>
            {pet.allergies && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 pt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>ALERGIA: {pet.allergies}</span>
              </div>
            )}
          </div>

          {/* Medications */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-1.5">
              {lang === 'pt-BR' ? 'Prescrição e Posologia' : 'Prescripción y Posología'}
            </h3>
            <ol className="space-y-4">
              {rx.items.map((item, idx) => (
                <li key={idx} className="pb-3 border-b border-slate-100 last:border-b-0">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-semibold text-sm text-slate-900">
                      {idx + 1}. {item.medication_name}
                    </span>
                    <span className="text-xs font-mono-tabular text-slate-700 shrink-0">
                      {item.quantity_text}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 mt-1">
                    {lang === 'pt-BR' ? 'Dose' : 'Dosis'}: <strong>{item.calculated_dose}</strong> ·{' '}
                    {lang === 'pt-BR' ? 'Via' : 'Vía'}: {item.route} · {item.frequency} · {item.duration_days}{' '}
                    {lang === 'pt-BR' ? 'dias' : 'días'}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {rx.instructions && (
            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 text-xs text-red-900">
              <strong>{lang === 'pt-BR' ? 'Observações Clínicas' : 'Indicaciones Especiales'}:</strong>{' '}
              {rx.instructions}
            </div>
          )}

          {/* Signature */}
          <div className="pt-8 flex flex-col items-center text-center">
            <div className="w-64 border-t border-slate-400 pt-2">
              <div className="text-sm font-semibold text-slate-900">{rx.vet_name}</div>
              <div className="text-xs text-slate-600">{rx.vet_reg}</div>
            </div>
          </div>

          {mode === 'demo' && (
            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
              Mascotas y Cia · Datos de ejemplo · Ciudad del Este, Paraguay
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
