import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  PawPrint,
  Phone,
  RefreshCw,
  Scissors,
  Stethoscope,
  Syringe,
  Weight,
} from 'lucide-react';
import type { AppLanguage, Pet } from '../shared/types';
import { formatDateShort, formatWeight } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { PetPhoto } from './ClinicLogo';

interface Bundle {
  pet: Pet & {
    tutor_name?: string;
    tutor_phone?: string;
    tutor_document?: string;
    tutor_address?: string;
  };
  weights: Array<{ id: number; weight_kg: number; recorded_at: string }>;
  consultations: Array<{
    id: number;
    visit_date: string;
    vet_name: string;
    assessment_dx: string;
    subjective: string;
    plan_conduct: string;
  }>;
  documents: Array<{ id: number; doc_type: string; title: string; created_at: string }>;
  vaccines: Array<{
    id: number;
    vaccine_name: string;
    applied_date: string;
    next_due_date: string;
    dose_number: string;
    batch_code: string;
  }>;
  grooming: Array<{
    id: number;
    created_at: string;
    status: string;
    service_name_es?: string;
    service_name_pt?: string;
  }>;
}

type Props = {
  ctx: ApiSessionContext;
  petId: number | null;
  pets: Pet[];
  lang: AppLanguage;
  onSelectPet: (id: number) => void;
  onOpenRecord: (id: number) => void;
  onNavigate: (tab: string) => void;
};

function ageText(birth: string | null | undefined) {
  if (!birth) return '—';
  const b = new Date(birth);
  if (Number.isNaN(b.getTime())) return '—';
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return '—';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years <= 0) return `${rest} m`;
  return `${years} a ${rest} m`;
}

export function PetProfileView({ ctx, petId, pets, lang, onSelectPet, onOpenRecord, onNavigate }: Props) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const tr = (es: string, pt: string) => (lang === 'pt-BR' ? pt : es);

  useEffect(() => {
    if (!petId) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<Bundle>(`/api/pets/${petId}/record`, ctx)
      .then((data) => {
        if (!cancelled) setBundle(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx, petId, reloadKey]);

  const events = useMemo(() => {
    if (!bundle) return [];
    const list: Array<{ key: string; date: string; icon: typeof Stethoscope; title: string; subtitle: string; danger?: boolean; onClick?: () => void }> = [];
    for (const c of bundle.consultations) {
      list.push({
        key: `c-${c.id}`,
        date: c.visit_date,
        icon: Stethoscope,
        title: c.assessment_dx || tr('Consulta', 'Consulta'),
        subtitle: `${c.vet_name} · ${tr('Historia clínica', 'Prontuário')}`,
        onClick: () => onOpenRecord(bundle.pet.id),
      });
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const v of bundle.vaccines) {
      list.push({
        key: `v-${v.id}`,
        date: v.applied_date,
        icon: Syringe,
        title: v.vaccine_name,
        subtitle: v.next_due_date
          ? `${tr('Próxima dosis', 'Próxima dose')}: ${formatDateShort(v.next_due_date, lang)}`
          : tr('Sin refuerzo programado', 'Sem reforço programado'),
        danger: !!v.next_due_date && v.next_due_date < today,
      });
    }
    for (const d of bundle.documents) {
      list.push({
        key: `d-${d.id}`,
        date: d.created_at,
        icon: FileText,
        title: d.title,
        subtitle: d.doc_type,
      });
    }
    for (const g of bundle.grooming) {
      const status: Record<string, string> = {
        scheduled: tr('Agendado', 'Agendado'),
        in_progress: tr('En atención', 'Em atendimento'),
        ready: tr('Listo', 'Pronto'),
        delivered: tr('Entregado', 'Entregue'),
      };
      list.push({
        key: `g-${g.id}`,
        date: g.created_at,
        icon: Scissors,
        title: (lang === 'pt-BR' ? g.service_name_pt : g.service_name_es) || tr('Baño y tosa', 'Banho e tosa'),
        subtitle: status[g.status] || g.status,
      });
    }
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 14);
  }, [bundle, lang, onOpenRecord]);

  if (!petId) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <PawPrint className="w-8 h-8 text-slate-300 mx-auto" />
        <p className="mt-3 text-sm font-medium text-slate-700">{tr('Ninguna mascota seleccionada.', 'Nenhum pet selecionado.')}</p>
        <p className="mt-1 text-xs text-slate-500">{tr('Elija una mascota en Tutores y Pets.', 'Escolha um pet em Tutores e Pets.')}</p>
        <button onClick={() => onNavigate('patients')} className="mt-4 min-h-[38px] px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold">
          {tr('Ir a Tutores y Pets', 'Ir para Tutores e Pets')}
        </button>
      </div>
    );
  }

  if (loading && !bundle) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-56 rounded bg-slate-200 animate-pulse" />
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-72 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-72 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-800">
        <p className="font-semibold">{tr('No se pudo cargar la ficha.', 'Não foi possível carregar a ficha.')}</p>
        <p className="mt-1 text-xs">{error}</p>
        <button onClick={() => setReloadKey((k) => k + 1)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold">
          <RefreshCw className="w-3.5 h-3.5" /> {tr('Reintentar', 'Tentar novamente')}
        </button>
      </div>
    );
  }

  if (!bundle) return null;
  const pet = bundle.pet;
  const lastWeight = bundle.weights.length ? bundle.weights[bundle.weights.length - 1] : null;
  const species = pet.species === 'dog' ? tr('Canino', 'Cão') : pet.species === 'cat' ? tr('Felino', 'Gato') : tr('Otro', 'Outro');
  const sex = pet.sex === 'M' ? tr('Macho', 'Macho') : tr('Hembra', 'Fêmea');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{tr('Ficha del pet', 'Ficha do pet')}</h1>
          <p className="text-sm text-slate-500">
            {pet.name} · {pet.tutor_name || pet.tutor_name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={tr('Elegir mascota', 'Escolher pet')}
            value={pet.id}
            onChange={(e) => onSelectPet(Number(e.target.value))}
            className="h-9 max-w-[220px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
          >
            {pets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.tutor_name || ''}
              </option>
            ))}
          </select>
          <button onClick={() => onOpenRecord(pet.id)} className="min-h-[36px] px-3 rounded-lg bg-teal-700 text-white text-xs font-semibold">
            {tr('Historia clínica', 'Prontuário')}
          </button>
          <button onClick={() => onNavigate('agenda')} className="min-h-[36px] px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700">
            {tr('Agendar', 'Agendar')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex flex-wrap items-start gap-4">
              <PetPhoto src={pet.photo_url} name={pet.name} className="w-20 h-20 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{pet.name}</h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{species}</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">{sex}</span>
                  {pet.neutered ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{tr('Castrado', 'Castrado')}</span> : null}
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {pet.breed || '—'} · {ageText(pet.birth_date)} · {formatWeight(lastWeight ? lastWeight.weight_kg : pet.weight_kg, 'es')}
                </p>
                <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                  <div>
                    <dt className="text-slate-500">{tr('Microchip', 'Microchip')}</dt>
                    <dd className="font-mono-tabular text-slate-900">{pet.microchip || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tr('Nacimiento', 'Nascimento')}</dt>
                    <dd className="font-mono-tabular text-slate-900">{pet.birth_date ? formatDateShort(pet.birth_date, lang) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">{tr('Temperamento', 'Temperamento')}</dt>
                    <dd className="text-slate-900">{pet.temperament || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {pet.allergies ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <span className="font-bold">{tr('Alergias', 'Alergias')}:</span> {pet.allergies}
                </p>
              </div>
            ) : null}
            {pet.chronic_conditions ? (
              <p className="mt-2 text-xs text-slate-600">
                <span className="font-semibold">{tr('Condiciones crónicas', 'Condições crônicas')}:</span> {pet.chronic_conditions}
              </p>
            ) : null}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Weight className="w-4 h-4 text-teal-700" /> {tr('Curva de peso', 'Curva de peso')}
              </h2>
              <span className="text-xs text-slate-500">{lastWeight ? formatWeight(lastWeight.weight_kg, 'es') : '—'}</span>
            </div>
            {bundle.weights.length < 2 ? (
              <p className="mt-4 text-xs text-slate-500">{tr('Registre al menos dos pesos para ver la curva.', 'Registre ao menos dois pesos para ver a curva.')}</p>
            ) : (
              <WeightChart weights={bundle.weights} />
            )}
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">{tr('Línea de tiempo', 'Linha do tempo')}</h2>
              <button onClick={() => onOpenRecord(pet.id)} className="text-xs font-medium text-teal-700">
                {tr('Ver historia completa', 'Ver histórico completo')}
              </button>
            </div>
            {events.length === 0 ? (
              <p className="px-5 py-6 text-xs text-slate-500">{tr('Sin eventos registrados.', 'Nenhum evento registrado.')}</p>
            ) : (
              <ol className="divide-y divide-slate-100">
                {events.map((event) => {
                  const Icon = event.icon;
                  return (
                    <li key={event.key}>
                      <button
                        type="button"
                        onClick={event.onClick}
                        disabled={!event.onClick}
                        className="w-full text-left px-5 py-3 flex items-start gap-3 hover:bg-slate-50 disabled:cursor-default"
                      >
                        <span className={`mt-0.5 grid w-7 h-7 place-items-center rounded-full ${event.danger ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-xs font-semibold ${event.danger ? 'text-red-800' : 'text-slate-900'}`}>{event.title}</span>
                          <span className="block text-[11px] text-slate-500">{event.subtitle}</span>
                        </span>
                        <span className="font-mono-tabular text-[11px] text-slate-400 shrink-0">{formatDateShort(event.date, lang)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900">{tr('Tutor', 'Tutor')}</h2>
            <p className="mt-2 text-sm font-medium text-slate-900">{pet.tutor_name || '—'}</p>
            <p className="text-xs text-slate-500">{pet.tutor_document || '—'}</p>
            <div className="mt-3 space-y-2 text-xs">
              <p className="flex items-center gap-2 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> {pet.tutor_phone || '—'}
              </p>
              {pet.tutor_address ? <p className="text-slate-600">{pet.tutor_address}</p> : null}
            </div>
            <button onClick={() => onNavigate('patients')} className="mt-4 w-full min-h-[36px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {tr('Ver ficha del tutor', 'Ver ficha do tutor')}
            </button>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Syringe className="w-4 h-4 text-teal-700" /> {tr('Vacunas', 'Vacinas')}
            </h2>
            {bundle.vaccines.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">{tr('Sin vacunas registradas.', 'Sem vacinas registradas.')}</p>
            ) : (
              <ul className="mt-3 space-y-2 text-xs">
                {bundle.vaccines.slice(0, 4).map((v) => {
                  const late = !!v.next_due_date && v.next_due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <li key={v.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900 truncate">{v.vaccine_name}</span>
                        <span className="block text-[11px] text-slate-500">
                          {formatDateShort(v.applied_date, lang)} · {tr('lote', 'lote')} {v.batch_code}
                        </span>
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${late ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {v.next_due_date ? formatDateShort(v.next_due_date, lang) : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <button onClick={() => onNavigate('vaccines')} className="mt-4 w-full min-h-[36px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
              {tr('Abrir cartilla', 'Abrir carteira')}
            </button>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-700" /> {tr('Accesos', 'Acessos')}
            </h2>
            <div className="mt-3 grid gap-2">
              <button onClick={() => onNavigate('agenda')} className="min-h-[36px] rounded-lg bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100">
                {tr('Agendar baño o consulta', 'Agendar banho ou consulta')}
              </button>
              <button onClick={() => onOpenRecord(pet.id)} className="min-h-[36px] rounded-lg bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100">
                {tr('Nueva evolución SOAP', 'Nova evolução SOAP')}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function WeightChart({ weights }: { weights: Array<{ weight_kg: number }> }) {
  const values = weights.map((w) => Number(w.weight_kg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = 12 + (index / (values.length - 1 || 1)) * 276;
    const y = 68 - ((value - min) / range) * 48;
    return { x, y };
  });
  return (
    <div className="mt-3">
      <svg viewBox="0 0 300 80" className="w-full h-20" role="img" aria-label="Curva de peso">
        <line x1="12" y1="68" x2="288" y2="68" stroke="#e2e8f0" strokeWidth="1" />
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#6b2f79"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#6b2f79" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 font-mono-tabular">
        <span>{values[0]} kg</span>
        <span>{values[values.length - 1]} kg</span>
      </div>
    </div>
  );
}
