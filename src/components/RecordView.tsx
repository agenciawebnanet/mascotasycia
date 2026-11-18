import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  FileText,
  Lock,
  Mic,
  MicOff,
  Pill,
  Plus,
  Printer,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import type {
  AppLanguage,
  AppMode,
  ClinicalDocument,
  Comanda,
  Consultation,
  GroomingOrder,
  Pet,
  PetWeight,
  Prescription,
  PrescriptionItem,
  Store,
  VaccineRecord,
} from '../shared/types';
import { getTranslations } from '../shared/i18n';
import { formatCurrency, formatDateShort, formatDateTime, formatWeight } from '../shared/currency';
import { apiFetch, type ApiSessionContext } from '../lib/api';
import { downloadClinicalDocPdf } from '../lib/pdf';
import { PetPhoto } from './ClinicLogo';
import { PrescriptionModal } from './PrescriptionModal';

interface RecordBundle {
  pet: Pet & { tutor_document?: string; tutor_address?: string };
  weights: PetWeight[];
  consultations: Consultation[];
  documents: ClinicalDocument[];
  vaccines: VaccineRecord[];
  grooming: GroomingOrder[];
  comandas: Comanda[];
}

interface Props {
  ctx: ApiSessionContext;
  store: Store;
  lang: AppLanguage;
  mode: AppMode;
  pets: Pet[];
  selectedPetId: number | null;
  onSelectPet: (petId: number) => void;
  onRefreshBootstrap: () => Promise<void>;
}

export function RecordView({
  ctx,
  store,
  lang,
  mode,
  pets,
  selectedPetId,
  onSelectPet,
  onRefreshBootstrap,
}: Props) {
  const t = getTranslations(lang);
  const activePetId = selectedPetId ?? pets[0]?.id ?? null;

  const [bundle, setBundle] = useState<RecordBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'soap' | 'timeline' | 'docs' | 'weight'>('soap');

  // New SOAP consultation form
  const [showNewSoap, setShowNewSoap] = useState(false);
  const [soapForm, setSoapForm] = useState({
    subjective: '',
    objective_exam: '',
    temp_c: '38.5',
    heart_rate: '96',
    resp_rate: '24',
    weight_kg: '',
    assessment_dx: '',
    cid_vet: '',
    plan_conduct: '',
    return_date: '',
  });

  // Optional Gemini AI SOAP draft assistant
  const [aiTranscript, setAiTranscript] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiIsDrafted, setAiIsDrafted] = useState(false);
  const [listening, setListening] = useState(false);

  // Addenda inline state per consultation
  const [addendumDrafts, setAddendumDrafts] = useState<Record<number, string>>({});
  const [openAddendumFor, setOpenAddendumFor] = useState<number | null>(null);

  // New Prescription modal state
  const [rxConsultId, setRxConsultId] = useState<number | null>(null);
  const [rxType, setRxType] = useState<'normal' | 'controlled'>('normal');
  const [rxValidUntil, setRxValidUntil] = useState(
    new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
  );
  const [rxInstructions, setRxInstructions] = useState('');
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([
    {
      medication_name: '',
      dose_mg_kg: 10,
      calculated_dose: '',
      route: 'Oral (VO)',
      frequency: 'Cada 12 horas',
      duration_days: 5,
      quantity_text: '1 caja',
    },
  ]);

  // Print/PDF Prescription preview modal
  const [previewRx, setPreviewRx] = useState<Prescription | null>(null);

  // New Clinical Document form
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [docForm, setDocForm] = useState({
    doc_type: 'report' as ClinicalDocument['doc_type'],
    title: '',
    content: '',
    file_url: '',
    released_to_tutor: true,
  });

  async function loadRecord(petId: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<RecordBundle>(`/api/pets/${petId}/record`, ctx);
      setBundle(data);
      setSoapForm((prev) => ({ ...prev, weight_kg: String(data.pet.weight_kg) }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activePetId) {
      loadRecord(activePetId);
    }
  }, [activePetId, ctx.mode, ctx.storeId]);

  const timelineItems = useMemo(() => {
    if (!bundle) return [];
    const items: Array<{ id: string; date: string; kind: string; title: string; subtitle: string }> = [];
    bundle.consultations.forEach((c) =>
      items.push({
        id: `c-${c.id}`,
        date: c.visit_date,
        kind: lang === 'pt-BR' ? 'Consulta SOAP' : 'Consulta SOAP',
        title: c.assessment_dx,
        subtitle: `${c.vet_name} · ${c.weight_kg ?? bundle.pet.weight_kg} kg`,
      }),
    );
    bundle.vaccines.forEach((v) =>
      items.push({
        id: `v-${v.id}`,
        date: v.applied_date,
        kind: lang === 'pt-BR' ? 'Vacina' : 'Vacuna',
        title: `${v.vaccine_name} (${v.dose_number})`,
        subtitle: `Lote ${v.batch_code} · ${v.vet_name}`,
      }),
    );
    bundle.documents.forEach((d) =>
      items.push({
        id: `d-${d.id}`,
        date: d.created_at,
        kind: d.doc_type === 'exam_pdf' ? (lang === 'pt-BR' ? 'Exame' : 'Examen') : (lang === 'pt-BR' ? 'Documento' : 'Documento'),
        title: d.title,
        subtitle: d.created_by,
      }),
    );
    bundle.grooming.forEach((g) =>
      items.push({
        id: `g-${g.id}`,
        date: g.created_at,
        kind: lang === 'pt-BR' ? 'Banho e Tosa' : 'Baño y Tosa',
        title: (lang === 'pt-BR' ? g.service_name_pt : g.service_name_es) || 'Baño',
        subtitle: `${g.groomer_name} · ${t.grooming[g.status]}`,
      }),
    );
    bundle.comandas.forEach((cm) =>
      items.push({
        id: `cm-${cm.id}`,
        date: cm.created_at,
        kind: 'PDV',
        title: `Comanda #${cm.id} · ${formatCurrency(cm.total, store.currency)}`,
        subtitle: cm.status.toUpperCase(),
      }),
    );
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bundle, lang, store.currency, t.grooming]);

  function startDictation() {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setAiError(
        lang === 'pt-BR'
          ? 'Ditado por voz não suportado neste navegador. Você pode digitar as notas abaixo.'
          : 'Dictado por voz no soportado en este navegador. Puede escribir las notas abajo.',
      );
      return;
    }
    const rec = new SpeechRec();
    rec.lang = lang === 'pt-BR' ? 'pt-BR' : 'es-PY';
    rec.interimResults = false;
    setListening(true);
    setAiError(null);
    rec.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript || '';
      setAiTranscript((prev) => (prev ? `${prev} ${text}` : text));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  async function handleGenerateAiDraft() {
    if (!bundle) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await apiFetch<{ draft: { subjective: string; objective_exam: string; assessment_dx: string; plan_conduct: string } }>(
        '/api/ai/soap-draft',
        ctx,
        {
          method: 'POST',
          body: JSON.stringify({
            transcript: aiTranscript,
            petName: bundle.pet.name,
            species: bundle.pet.species,
            weightKg: bundle.pet.weight_kg,
            allergies: bundle.pet.allergies,
          }),
        },
      );
      setSoapForm((prev) => ({
        ...prev,
        subjective: res.draft.subjective || prev.subjective,
        objective_exam: res.draft.objective_exam || prev.objective_exam,
        assessment_dx: res.draft.assessment_dx || prev.assessment_dx,
        plan_conduct: res.draft.plan_conduct || prev.plan_conduct,
      }));
      setAiIsDrafted(true);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveConsultation(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle) return;
    setError(null);
    try {
      await apiFetch('/api/consultations', ctx, {
        method: 'POST',
        body: JSON.stringify({
          pet_id: bundle.pet.id,
          subjective: soapForm.subjective,
          objective_exam: soapForm.objective_exam,
          temp_c: soapForm.temp_c ? Number(soapForm.temp_c) : null,
          heart_rate: soapForm.heart_rate ? Number(soapForm.heart_rate) : null,
          resp_rate: soapForm.resp_rate ? Number(soapForm.resp_rate) : null,
          weight_kg: soapForm.weight_kg ? Number(soapForm.weight_kg) : bundle.pet.weight_kg,
          assessment_dx: soapForm.assessment_dx,
          cid_vet: soapForm.cid_vet,
          plan_conduct: soapForm.plan_conduct,
          return_date: soapForm.return_date || null,
        }),
      });
      setShowNewSoap(false);
      setAiIsDrafted(false);
      setAiTranscript('');
      setSoapForm({
        subjective: '',
        objective_exam: '',
        temp_c: '38.5',
        heart_rate: '96',
        resp_rate: '24',
        weight_kg: String(bundle.pet.weight_kg),
        assessment_dx: '',
        cid_vet: '',
        plan_conduct: '',
        return_date: '',
      });
      await loadRecord(bundle.pet.id);
      await onRefreshBootstrap();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleAddAddendum(consultationId: number) {
    const note = addendumDrafts[consultationId]?.trim();
    if (!note || !bundle) return;
    setError(null);
    try {
      await apiFetch(`/api/consultations/${consultationId}/addenda`, ctx, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      setAddendumDrafts((prev) => ({ ...prev, [consultationId]: '' }));
      setOpenAddendumFor(null);
      await loadRecord(bundle.pet.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreatePrescription(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle || !rxConsultId) return;
    setError(null);
    try {
      const preparedItems = rxItems.map((it) => {
        const calc =
          it.calculated_dose?.trim() ||
          (it.dose_mg_kg ? `${(it.dose_mg_kg * bundle.pet.weight_kg).toFixed(1)} mg (${it.dose_mg_kg} mg/kg × ${bundle.pet.weight_kg} kg)` : 'Conforme posologia');
        return { ...it, calculated_dose: calc };
      });
      const created = await apiFetch<Prescription>('/api/prescriptions', ctx, {
        method: 'POST',
        body: JSON.stringify({
          consultation_id: rxConsultId,
          pet_id: bundle.pet.id,
          type: rxType,
          valid_until: rxValidUntil,
          instructions: rxInstructions,
          items: preparedItems,
        }),
      });
      setRxConsultId(null);
      await loadRecord(bundle.pet.id);
      setPreviewRx(created);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!bundle) return;
    setError(null);
    try {
      await apiFetch('/api/documents', ctx, {
        method: 'POST',
        body: JSON.stringify({
          pet_id: bundle.pet.id,
          consultation_id: bundle.consultations[0]?.id ?? null,
          ...docForm,
        }),
      });
      setShowNewDoc(false);
      setDocForm({ doc_type: 'report', title: '', content: '', file_url: '', released_to_tutor: true });
      await loadRecord(bundle.pet.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleToggleDocRelease(docId: number, nextState: boolean) {
    if (!bundle) return;
    try {
      await apiFetch(`/api/documents/${docId}/release`, ctx, {
        method: 'PATCH',
        body: JSON.stringify({ released: nextState }),
      });
      await loadRecord(bundle.pet.id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header & Patient Selector Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.record.title}</h1>
          <p className="text-xs text-slate-500 mt-0.5 inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-teal-700" />
            {t.record.immutableNote}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {pets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectPet(p.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                p.id === activePetId
                  ? 'bg-teal-700 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loading || !bundle ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
          {lang === 'pt-BR' ? 'Carregando prontuário...' : 'Cargando historia clínica...'}
        </div>
      ) : (
        <>
          {/* Patient Clinical Header Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <PetPhoto src={bundle.pet.photo_url} name={bundle.pet.name} className="w-16 h-16 rounded-xl" />
                <div>
                  <div className="flex flex-wrap items-baseline gap-2.5">
                    <h2 className="text-xl font-bold text-slate-900">{bundle.pet.name}</h2>
                    <span className="text-sm font-mono-tabular font-semibold text-teal-800">
                      {formatWeight(bundle.pet.weight_kg, lang)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {bundle.pet.breed} · {bundle.pet.sex === 'M' ? t.patients.sexM : t.patients.sexF} ·{' '}
                    {bundle.pet.neutered ? t.patients.neutered : t.patients.notNeutered} · Microchip:{' '}
                    <span className="font-mono-tabular">{bundle.pet.microchip || '—'}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Tutor: <strong className="text-slate-800">{bundle.pet.tutor_name}</strong> · {bundle.pet.tutor_phone}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {bundle.consultations[0]?.prescriptions?.[0] && (
                  <button
                    type="button"
                    onClick={() => setPreviewRx(bundle.consultations[0].prescriptions![0])}
                    className="min-h-[42px] px-4 py-2 rounded-lg border border-teal-700 text-teal-800 bg-teal-50/70 hover:bg-teal-100/70 text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <Printer className="w-4 h-4" />
                    {t.dashboard.printRx}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowNewSoap((v) => !v)}
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  {t.record.newConsultation}
                </button>
              </div>
            </div>

            {bundle.pet.allergies && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <strong className="font-bold">{t.patients.allergyAlert}: </strong>
                  <span>{bundle.pet.allergies}</span>
                </div>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
              {(
                [
                  ['soap', t.record.consultations],
                  ['timeline', t.record.timeline],
                  ['docs', t.record.examsDocs],
                  ['weight', t.record.weightCurve],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSubTab(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    subTab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* New SOAP Form + Optional AI Draft */}
          {showNewSoap && (
            <form onSubmit={handleSaveConsultation} className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">{t.record.newConsultation}</h3>
                <button type="button" onClick={() => setShowNewSoap(false)} className="text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Optional Gemini AI Transcription Draft */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                    {t.record.aiDraftTitle}
                  </div>
                  {aiIsDrafted && (
                    <span className="text-[11px] font-semibold text-amber-800">
                      {lang === 'pt-BR' ? 'Rascunho IA — Revisar antes de assinar' : 'Borrador IA — Revisar antes de firmar'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-600">{t.record.aiDraftNotice}</p>
                <textarea
                  rows={2}
                  value={aiTranscript}
                  onChange={(e) => setAiTranscript(e.target.value)}
                  placeholder={t.record.aiTranscriptPlaceholder}
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                {aiError && <div className="text-xs text-red-700">{aiError}</div>}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={startDictation}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                  >
                    {listening ? <MicOff className="w-3.5 h-3.5 text-red-600" /> : <Mic className="w-3.5 h-3.5 text-teal-700" />}
                    {listening ? t.record.aiListening : t.record.aiDictate}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateAiDraft}
                    disabled={aiLoading || !aiTranscript.trim()}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium disabled:opacity-50"
                  >
                    {aiLoading ? t.record.aiGenerating : t.record.aiGenerateBtn}
                  </button>
                </div>
              </div>

              {/* Vital signs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.record.weightKg}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={soapForm.weight_kg}
                    onChange={(e) => setSoapForm({ ...soapForm, weight_kg: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.record.tempC}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={soapForm.temp_c}
                    onChange={(e) => setSoapForm({ ...soapForm, temp_c: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.record.heartRate}</label>
                  <input
                    type="number"
                    value={soapForm.heart_rate}
                    onChange={(e) => setSoapForm({ ...soapForm, heart_rate: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">{t.record.respRate}</label>
                  <input
                    type="number"
                    value={soapForm.resp_rate}
                    onChange={(e) => setSoapForm({ ...soapForm, resp_rate: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">{t.record.subjective} *</label>
                  <textarea
                    required
                    rows={3}
                    value={soapForm.subjective}
                    onChange={(e) => setSoapForm({ ...soapForm, subjective: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">{t.record.objective} *</label>
                  <textarea
                    required
                    rows={3}
                    value={soapForm.objective_exam}
                    onChange={(e) => setSoapForm({ ...soapForm, objective_exam: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">{t.record.assessment} *</label>
                  <textarea
                    required
                    rows={2}
                    value={soapForm.assessment_dx}
                    onChange={(e) => setSoapForm({ ...soapForm, assessment_dx: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <input
                      placeholder={t.record.cidVet}
                      value={soapForm.cid_vet}
                      onChange={(e) => setSoapForm({ ...soapForm, cid_vet: e.target.value })}
                      className="h-9 px-3 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="date"
                      title={t.record.returnDate}
                      value={soapForm.return_date}
                      onChange={(e) => setSoapForm({ ...soapForm, return_date: e.target.value })}
                      className="h-9 px-3 border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1">{t.record.plan} *</label>
                  <textarea
                    required
                    rows={4}
                    value={soapForm.plan_conduct}
                    onChange={(e) => setSoapForm({ ...soapForm, plan_conduct: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSoap(false)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700"
                >
                  {t.patients.cancel}
                </button>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  {t.record.signAndLock}
                </button>
              </div>
            </form>
          )}

          {/* SUBTAB: SOAP CONSULTATIONS */}
          {subTab === 'soap' && (
            <div className="space-y-4">
              {bundle.consultations.map((c) => (
                <article key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{c.assessment_dx}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {formatDateTime(c.visit_date, lang)} · {c.vet_name} ({c.vet_reg})
                        {c.cid_vet ? ` · CID: ${c.cid_vet}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular text-slate-700">
                      <span>{c.weight_kg ?? bundle.pet.weight_kg} kg</span>
                      {c.temp_c && <span>· {c.temp_c}°C</span>}
                      {c.heart_rate && <span>· FC {c.heart_rate}</span>}
                      {c.resp_rate && <span>· FR {c.resp_rate}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs font-semibold text-teal-800 mb-1">{t.record.subjective}</div>
                      <p className="text-slate-700 leading-relaxed">{c.subjective}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-teal-800 mb-1">{t.record.objective}</div>
                      <p className="text-slate-700 leading-relaxed">{c.objective_exam}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-teal-800 mb-1">{t.record.assessment}</div>
                      <p className="text-slate-900 font-medium">{c.assessment_dx}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-teal-800 mb-1">{t.record.plan}</div>
                      <p className="text-slate-700 leading-relaxed">{c.plan_conduct}</p>
                    </div>
                  </div>

                  {/* Prescriptions attached to this consultation */}
                  {c.prescriptions && c.prescriptions.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {c.prescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-900 inline-flex items-center gap-1.5">
                              <Pill className="w-3.5 h-3.5 text-teal-700" />
                              {rx.type === 'controlled' ? t.record.rxTypeControlled : t.record.rxTypeNormal} ·{' '}
                              {rx.items.map((i) => i.medication_name).join(', ')}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {formatDateShort(rx.created_at, lang)} · {rx.vet_name}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPreviewRx(rx)}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            {t.record.printRxA4}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Addenda list */}
                  {c.addenda && c.addenda.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-2">
                      {c.addenda.map((ad) => (
                        <div key={ad.id} className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-xs text-slate-800">
                          <div className="font-semibold text-amber-900">
                            Adendo · {ad.author_name} · {formatDateTime(ad.created_at, lang)}
                          </div>
                          <p className="mt-1">{ad.note}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action row: Prescribe + Add Addendum */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRxConsultId(c.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
                      >
                        <Pill className="w-3.5 h-3.5 text-teal-700" />
                        {t.record.rxTitle}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenAddendumFor(openAddendumFor === c.id ? null : c.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700"
                      >
                        {t.record.addAddendum}
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      {formatDateTime(c.signed_at, lang)}
                    </span>
                  </div>

                  {openAddendumFor === c.id && (
                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                      <input
                        value={addendumDrafts[c.id] || ''}
                        onChange={(e) => setAddendumDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        placeholder={t.record.addendumPlaceholder}
                        className="flex-1 h-10 px-3 border border-slate-200 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddAddendum(c.id)}
                        className="min-h-[40px] px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium whitespace-nowrap"
                      >
                        {t.record.addAddendum}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* SUBTAB: UNIFIED TIMELINE */}
          {subTab === 'timeline' && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {timelineItems.map((item) => (
                <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-teal-800">{item.kind}</div>
                    <div className="text-sm font-semibold text-slate-900 mt-0.5">{item.title}</div>
                    <div className="text-xs text-slate-500">{item.subtitle}</div>
                  </div>
                  <div className="text-xs font-mono-tabular text-slate-500 shrink-0">
                    {formatDateShort(item.date, lang)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SUBTAB: DOCUMENTS & EXAMS */}
          {subTab === 'docs' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewDoc((v) => !v)}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  {t.record.newDocTitle}
                </button>
              </div>

              {showNewDoc && (
                <form onSubmit={handleCreateDocument} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select
                      value={docForm.doc_type}
                      onChange={(e) => setDocForm({ ...docForm, doc_type: e.target.value as any })}
                      className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
                    >
                      <option value="report">{t.record.docReport}</option>
                      <option value="certificate">{t.record.docCertificate}</option>
                      <option value="surgical_consent">{t.record.docConsent}</option>
                      <option value="exam_pdf">{t.record.docExam}</option>
                    </select>
                    <input
                      required
                      placeholder={lang === 'pt-BR' ? 'Título do documento / exame' : 'Título del documento / examen'}
                      value={docForm.title}
                      onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                      className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
                    />
                  </div>
                  <textarea
                    required
                    rows={3}
                    placeholder={lang === 'pt-BR' ? 'Conteúdo clínico ou resumo do laudo...' : 'Contenido clínico o resumen del resultado...'}
                    value={docForm.content}
                    onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                    className="w-full p-3 border border-slate-200 rounded-lg text-sm"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={docForm.released_to_tutor}
                      onChange={(e) => setDocForm({ ...docForm, released_to_tutor: e.target.checked })}
                      className="w-4 h-4 accent-teal-700"
                    />
                    <span>{t.record.releaseToTutor}</span>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowNewDoc(false)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                    >
                      {t.patients.cancel}
                    </button>
                    <button
                      type="submit"
                      className="min-h-[38px] px-4 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-medium"
                    >
                      {t.patients.save}
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {bundle.documents.map((docItem) => (
                  <div key={docItem.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-teal-700 shrink-0" />
                        <span className="text-sm font-bold text-slate-900">{docItem.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleDocRelease(docItem.id, !docItem.released_to_tutor)}
                          className={`min-h-[34px] px-3 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${
                            docItem.released_to_tutor
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {docItem.released_to_tutor ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          {docItem.released_to_tutor ? t.record.released : t.record.locked}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadClinicalDocPdf(docItem, bundle.pet, store, lang, mode)}
                          className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-800 inline-flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed">{docItem.content}</p>
                    <div className="text-[11px] text-slate-400">
                      {docItem.created_by} · {formatDateTime(docItem.created_at, lang)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB: WEIGHT CURVE */}
          {subTab === 'weight' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                {t.record.weightCurve} — {bundle.pet.name}
              </h3>
              <div className="divide-y divide-slate-100">
                {bundle.weights.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {formatDateShort(w.recorded_at, lang)} · {w.recorded_by}
                    </span>
                    <span className="font-mono-tabular font-bold text-slate-900">{formatWeight(w.weight_kg, lang)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal: Weight-based Prescription Builder */}
      {rxConsultId && bundle && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto overflow-y-auto">
          <form
            onSubmit={handleCreatePrescription}
            className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 space-y-4 my-auto max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{t.record.rxTitle}</h3>
                <p className="text-xs text-slate-500">
                  {bundle.pet.name} · <strong className="font-mono-tabular">{formatWeight(bundle.pet.weight_kg, lang)}</strong>
                </p>
              </div>
              <button type="button" onClick={() => setRxConsultId(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {bundle.pet.allergies && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-800">
                {t.patients.allergyAlert}: {bundle.pet.allergies}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={rxType}
                onChange={(e) => setRxType(e.target.value as any)}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm bg-white"
              >
                <option value="normal">{t.record.rxTypeNormal}</option>
                <option value="controlled">{t.record.rxTypeControlled}</option>
              </select>
              <input
                type="date"
                value={rxValidUntil}
                onChange={(e) => setRxValidUntil(e.target.value)}
                className="h-10 px-3 border border-slate-200 rounded-lg text-sm"
              />
            </div>

            <div className="space-y-3">
              {rxItems.map((item, idx) => {
                const autoCalc = item.dose_mg_kg
                  ? `${(item.dose_mg_kg * bundle.pet.weight_kg).toFixed(1)} mg`
                  : '';
                return (
                  <div key={idx} className="p-3 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        required
                        placeholder={t.record.medication}
                        value={item.medication_name}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx] = { ...next[idx], medication_name: e.target.value };
                          setRxItems(next);
                        }}
                        className="sm:col-span-2 h-9 px-3 border border-slate-200 rounded-lg text-sm"
                      />
                      <input
                        type="number"
                        step="0.1"
                        placeholder={t.record.doseMgKg}
                        value={item.dose_mg_kg ?? ''}
                        onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          const next = [...rxItems];
                          next[idx] = {
                            ...next[idx],
                            dose_mg_kg: val,
                            calculated_dose: val
                              ? `${(val * bundle.pet.weight_kg).toFixed(1)} mg (${val} mg/kg × ${bundle.pet.weight_kg} kg)`
                              : next[idx].calculated_dose,
                          };
                          setRxItems(next);
                        }}
                        className="h-9 px-3 border border-slate-200 rounded-lg text-sm font-mono-tabular"
                      />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        placeholder={autoCalc ? `${t.record.calcDose}: ${autoCalc}` : t.record.calcDose}
                        value={item.calculated_dose}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx] = { ...next[idx], calculated_dose: e.target.value };
                          setRxItems(next);
                        }}
                        className="h-9 px-3 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        placeholder={t.record.route}
                        value={item.route}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx] = { ...next[idx], route: e.target.value };
                          setRxItems(next);
                        }}
                        className="h-9 px-3 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        placeholder={t.record.frequency}
                        value={item.frequency}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx] = { ...next[idx], frequency: e.target.value };
                          setRxItems(next);
                        }}
                        className="h-9 px-3 border border-slate-200 rounded-lg text-xs"
                      />
                      <input
                        placeholder={t.record.quantityText}
                        value={item.quantity_text}
                        onChange={(e) => {
                          const next = [...rxItems];
                          next[idx] = { ...next[idx], quantity_text: e.target.value };
                          setRxItems(next);
                        }}
                        className="h-9 px-3 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  setRxItems([
                    ...rxItems,
                    {
                      medication_name: '',
                      dose_mg_kg: 10,
                      calculated_dose: '',
                      route: 'Oral (VO)',
                      frequency: 'Cada 12 horas',
                      duration_days: 5,
                      quantity_text: '1 caja',
                    },
                  ])
                }
                className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.record.addMedRow}
              </button>
            </div>

            <textarea
              rows={2}
              placeholder={lang === 'pt-BR' ? 'Recomendações ao tutor...' : 'Indicaciones al tutor...'}
              value={rxInstructions}
              onChange={(e) => setRxInstructions(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRxConsultId(null)}
                className="min-h-[40px] px-4 py-2 rounded-lg border border-slate-200 text-sm"
              >
                {t.patients.cancel}
              </button>
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium inline-flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                {t.record.printRxA4}
              </button>
            </div>
          </form>
        </div>
      )}

      {previewRx && bundle && (
        <PrescriptionModal
          rx={previewRx}
          pet={bundle.pet}
          store={store}
          lang={lang}
          mode={mode}
          onClose={() => setPreviewRx(null)}
        />
      )}
    </div>
  );
}
