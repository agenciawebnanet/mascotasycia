import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Lock,
  Plus,
  Search,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import type { AppLanguage, Pet, Store, Tutor } from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatCurrency, formatDateShort, formatWeight } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { PetPhoto } from './ClinicLogo';

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  tutors: Tutor[];
  pets: Pet[];
  onRefresh: () => Promise<void>;
  onOpenRecord: (petId: number) => void;
}

export function PatientsView({ ctx, store, lang, tutors, pets, onRefresh, onOpenRecord }: Props) {
  const t = getTranslations(lang);
  const [query, setQuery] = useState('');
  const [showQuickModal, setShowQuickModal] = useState<'none' | 'tutor' | 'pet'>('none');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Tutor form state
  const [tutorForm, setTutorForm] = useState({
    name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    credit_limit: '500000',
    lgpd_consent: true,
  });

  // Pet form state
  const [petForm, setPetForm] = useState({
    tutor_id: String(tutors[0]?.id || ''),
    name: '',
    species: 'dog' as 'dog' | 'cat' | 'other',
    breed: '',
    sex: 'M' as 'M' | 'F',
    birth_date: '2023-01-01',
    weight_kg: '10',
    microchip: '',
    neutered: false,
    allergies: '',
    chronic_conditions: '',
    temperament: '',
  });

  const filteredPets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pets;
    return pets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.breed.toLowerCase().includes(q) ||
        (p.tutor_name || '').toLowerCase().includes(q) ||
        (p.tutor_phone || '').toLowerCase().includes(q),
    );
  }, [pets, query]);

  async function handleCreateTutor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<Tutor>('/api/tutors', ctx, {
        method: 'POST',
        body: JSON.stringify({
          ...tutorForm,
          credit_limit: Number(tutorForm.credit_limit || 0),
        }),
      });
      await onRefresh();
      setPetForm((prev) => ({ ...prev, tutor_id: String(created.id) }));
      setTutorForm({
        name: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        credit_limit: '500000',
        lgpd_consent: true,
      });
      setShowQuickModal('pet');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreatePet(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/pets', ctx, {
        method: 'POST',
        body: JSON.stringify({
          ...petForm,
          tutor_id: Number(petForm.tutor_id),
          weight_kg: Number(petForm.weight_kg || 0),
        }),
      });
      await onRefresh();
      setPetForm({
        tutor_id: String(tutors[0]?.id || ''),
        name: '',
        species: 'dog',
        breed: '',
        sex: 'M',
        birth_date: '2023-01-01',
        weight_kg: '10',
        microchip: '',
        neutered: false,
        allergies: '',
        chronic_conditions: '',
        temperament: '',
      });
      setShowQuickModal('none');
      setNotice(lang === 'pt-BR' ? 'Paciente cadastrado com sucesso!' : '¡Paciente registrado correctamente!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLgpdExport(tutorId: number) {
    try {
      const data = await apiFetch<any>(`/api/tutors/${tutorId}/lgpd-export`, ctx);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lgpd_tutor_${tutorId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleLgpdAnonymize(tutorId: number) {
    try {
      await apiFetch(`/api/tutors/${tutorId}/lgpd-anonymize`, ctx, { method: 'POST' });
      await onRefresh();
      setNotice(lang === 'pt-BR' ? 'Dados pessoais do tutor anonimizados (LGPD).' : 'Datos personales del tutor anonimizados (LGPD).');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.patients.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.patients.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowQuickModal('tutor');
            }}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            {t.patients.newTutor}
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPetForm((p) => ({ ...p, tutor_id: p.tutor_id || String(tutors[0]?.id || '') }));
              setShowQuickModal('pet');
            }}
            className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            {t.patients.newPet}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-900 flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-teal-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.patients.searchPlaceholder}
          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/30 focus:border-teal-600"
        />
      </div>

      {/* Pets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPets.map((pet) => (
          <div
            key={pet.id}
            className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4"
          >
            <div className="flex items-start gap-4">
              <PetPhoto src={pet.photo_url} name={pet.name} className="w-16 h-16 rounded-xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900 truncate">{pet.name}</h3>
                  <span className="text-sm font-mono-tabular font-semibold text-teal-800 shrink-0">
                    {formatWeight(pet.weight_kg, lang)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {pet.species === 'dog' ? t.patients.speciesDog : pet.species === 'cat' ? t.patients.speciesCat : t.patients.speciesOther}{' '}
                  · {pet.breed} · {pet.sex === 'M' ? t.patients.sexM : t.patients.sexF} ·{' '}
                  {pet.neutered ? t.patients.neutered : t.patients.notNeutered}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Tutor: <strong className="text-slate-700">{pet.tutor_name}</strong> · {pet.tutor_phone}
                </div>
                {pet.microchip && (
                  <div className="text-xs text-slate-400 font-mono-tabular mt-0.5">
                    {t.patients.microchip}: {pet.microchip}
                  </div>
                )}
              </div>
            </div>

            {pet.allergies && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {t.patients.allergyAlert}: {pet.allergies}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 inline-flex items-center gap-1" title={t.patients.cannotDeletePet}>
                <Lock className="w-3 h-3" />
                {lang === 'pt-BR' ? 'Histórico protegido' : 'Historial protegido'}
              </span>
              <button
                type="button"
                onClick={() => onOpenRecord(pet.id)}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium whitespace-nowrap transition-colors"
              >
                {t.dashboard.openRecord}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tutors Directory + LGPD */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            {lang === 'pt-BR' ? 'Tutores cadastrados e conformidade LGPD' : 'Tutores registrados y cumplimiento LGPD'}
          </h2>
        </div>
        <div className="divide-y divide-slate-100">
          {tutors.map((tutor) => (
            <div key={tutor.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{tutor.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {tutor.document} · {tutor.phone} · {tutor.address || '—'}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {t.patients.creditLimit}: {formatCurrency(tutor.credit_limit, store.currency)} · LGPD:{' '}
                  {tutor.lgpd_consent ? formatDateShort(tutor.lgpd_consent_at, lang) : 'Pendiente'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleLgpdExport(tutor.id)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t.patients.lgpdExport}
                </button>
                {ctx.role === 'manager' && !tutor.anonymized && (
                  <button
                    type="button"
                    onClick={() => handleLgpdAnonymize(tutor.id)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-xs font-medium text-red-700 inline-flex items-center gap-1.5"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    {t.patients.lgpdAnonymize}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Modal: New Tutor / New Pet */}
      {showQuickModal !== 'none' && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {showQuickModal === 'tutor' ? t.patients.newTutor : t.patients.newPet}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickModal('none')}
                className="min-h-[40px] min-w-[40px] rounded-lg hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}

            {showQuickModal === 'tutor' ? (
              <form onSubmit={handleCreateTutor} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.tutorName} *</label>
                  <input
                    required
                    value={tutorForm.name}
                    onChange={(e) => setTutorForm({ ...tutorForm, name: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.document} *</label>
                    <input
                      required
                      value={tutorForm.document}
                      onChange={(e) => setTutorForm({ ...tutorForm, document: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.phone} *</label>
                    <input
                      required
                      value={tutorForm.phone}
                      onChange={(e) => setTutorForm({ ...tutorForm, phone: e.target.value })}
                      placeholder="+595981..."
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.email}</label>
                    <input
                      type="email"
                      value={tutorForm.email}
                      onChange={(e) => setTutorForm({ ...tutorForm, email: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.creditLimit}</label>
                    <input
                      type="number"
                      value={tutorForm.credit_limit}
                      onChange={(e) => setTutorForm({ ...tutorForm, credit_limit: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.address}</label>
                  <input
                    value={tutorForm.address}
                    onChange={(e) => setTutorForm({ ...tutorForm, address: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700 pt-1">
                  <input
                    type="checkbox"
                    checked={tutorForm.lgpd_consent}
                    onChange={(e) => setTutorForm({ ...tutorForm, lgpd_consent: e.target.checked })}
                    className="w-4 h-4 accent-teal-700"
                  />
                  <span>{t.patients.lgpdConsent}</span>
                </label>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowQuickModal('none')}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                  >
                    {t.patients.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {t.patients.save}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreatePet} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Tutor *</label>
                  <select
                    required
                    value={petForm.tutor_id}
                    onChange={(e) => setPetForm({ ...petForm, tutor_id: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    {tutors.map((tu) => (
                      <option key={tu.id} value={tu.id}>
                        {tu.name} ({tu.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.petName} *</label>
                    <input
                      required
                      value={petForm.name}
                      onChange={(e) => setPetForm({ ...petForm, name: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.species} *</label>
                    <select
                      value={petForm.species}
                      onChange={(e) => setPetForm({ ...petForm, species: e.target.value as any })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="dog">{t.patients.speciesDog}</option>
                      <option value="cat">{t.patients.speciesCat}</option>
                      <option value="other">{t.patients.speciesOther}</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.breed} *</label>
                    <input
                      required
                      value={petForm.breed}
                      onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.sex}</label>
                    <select
                      value={petForm.sex}
                      onChange={(e) => setPetForm({ ...petForm, sex: e.target.value as any })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="M">{t.patients.sexM}</option>
                      <option value="F">{t.patients.sexF}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.weight} (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={petForm.weight_kg}
                      onChange={(e) => setPetForm({ ...petForm, weight_kg: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.birthDate}</label>
                    <input
                      type="date"
                      value={petForm.birth_date}
                      onChange={(e) => setPetForm({ ...petForm, birth_date: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.microchip}</label>
                    <input
                      value={petForm.microchip}
                      onChange={(e) => setPetForm({ ...petForm, microchip: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.patients.allergies}</label>
                  <input
                    value={petForm.allergies}
                    onChange={(e) => setPetForm({ ...petForm, allergies: e.target.value })}
                    placeholder="Ej: Dipirona, Penicilina..."
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={petForm.neutered}
                    onChange={(e) => setPetForm({ ...petForm, neutered: e.target.checked })}
                    className="w-4 h-4 accent-teal-700"
                  />
                  <span>{t.patients.neutered}</span>
                </label>
                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowQuickModal('none')}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                  >
                    {t.patients.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium disabled:opacity-50"
                  >
                    {t.patients.save}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
