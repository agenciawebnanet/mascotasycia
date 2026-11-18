import { jsPDF } from 'jspdf';
import type {
  AppLanguage,
  AppMode,
  ClinicalDocument,
  FinancialEntry,
  Hospitalization,
  Pet,
  Prescription,
  Store,
  VaccineRecord,
} from '../shared/types';
import { formatCurrency, formatDateShort } from '../shared/currency';

function addDemoBanner(doc: jsPDF, mode: AppMode, pageWidth: number, pageHeight: number) {
  if (mode !== 'demo') return;
  doc.setFillColor(254, 243, 199);
  doc.rect(0, 0, pageWidth, 8, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14);
  doc.text('DATOS DE EJEMPLO / DADOS DE EXEMPLO — DEMOSTRACIÓN MASCOTAS & CIA', pageWidth / 2, 5.5, {
    align: 'center',
  });

  doc.setFillColor(248, 250, 252);
  doc.rect(0, pageHeight - 9, pageWidth, 9, 'F');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'VORTELOPET · Datos de ejemplo / Dados de exemplo · Documento ilustrativo sin validez legal en modo demostración',
    pageWidth / 2,
    pageHeight - 3.5,
    { align: 'center' },
  );
}

function addClinicHeader(doc: jsPDF, store: Store, mode: AppMode, startY = 14) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  addDemoBanner(doc, mode, pageWidth, pageHeight);

  if (store.logo_url && store.logo_url.startsWith('data:image/')) {
    try {
      doc.addImage(store.logo_url, 'PNG', 14, startY, 18, 18);
    } catch {
      drawMonogram(doc, store.name, 14, startY);
    }
  } else {
    drawMonogram(doc, store.name, 14, startY);
  }

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(store.name, 36, startY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${store.city} · ${store.tax_id_label}: ${store.tax_id}`, 36, startY + 11);
  doc.text(`${store.address} · Tel: ${store.phone}`, 36, startY + 15.5);

  doc.setDrawColor(203, 213, 225);
  doc.line(14, startY + 21, pageWidth - 14, startY + 21);
  return startY + 28;
}

function drawMonogram(doc: jsPDF, name: string, x: number, y: number) {
  doc.setFillColor(15, 118, 110);
  doc.roundedRect(x, y, 18, 18, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'VP';
  doc.text(initials, x + 9, y + 11, { align: 'center' });
}

export function downloadPrescriptionPdf(
  rx: Prescription,
  pet: Pet,
  store: Store,
  lang: AppLanguage,
  mode: AppMode,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addClinicHeader(doc, store, mode);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 118, 110);
  const title =
    rx.type === 'controlled'
      ? lang === 'pt-BR'
        ? 'RECEITUÁRIO VETERINÁRIO CONTROLADO'
        : 'RECETARIO VETERINARIO CONTROLADO'
      : lang === 'pt-BR'
        ? 'RECEITUÁRIO VETERINÁRIO'
        : 'RECETA MÉDICA VETERINARIA';
  doc.text(title, 14, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `${lang === 'pt-BR' ? 'Emissão' : 'Emisión'}: ${formatDateShort(rx.created_at, lang)} · ${
      lang === 'pt-BR' ? 'Validade' : 'Válida hasta'
    }: ${formatDateShort(rx.valid_until, lang)}`,
    pageWidth - 14,
    y,
    { align: 'right' },
  );
  y += 8;

  // Patient box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`${pet.name} (${pet.breed}) — ${pet.weight_kg} kg`, 18, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Tutor: ${pet.tutor_name || '—'} · Tel: ${pet.tutor_phone || '—'} · Microchip: ${pet.microchip || '—'}`,
    18,
    y + 13,
  );
  if (pet.allergies) {
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`${lang === 'pt-BR' ? 'ALERGIA' : 'ALERGIA'}: ${pet.allergies}`, 18, y + 18.5);
  }
  y += 30;

  // Medications
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(lang === 'pt-BR' ? 'Prescrição / Posologia' : 'Prescripción / Posología', 14, y);
  y += 6;

  rx.items.forEach((item, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}. ${item.medication_name}`, 14, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(item.quantity_text, pageWidth - 14, y, { align: 'right' });
    y += 5;

    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(
      `${lang === 'pt-BR' ? 'Dose' : 'Dosis'}: ${item.calculated_dose} · ${lang === 'pt-BR' ? 'Via' : 'Vía'}: ${item.route} · ${item.frequency} · ${item.duration_days} ${lang === 'pt-BR' ? 'dias' : 'días'}`,
      pageWidth - 32,
    );
    doc.text(lines, 18, y);
    y += lines.length * 4.5 + 4;
  });

  if (rx.instructions) {
    y += 2;
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(254, 202, 202);
    const instrLines = doc.splitTextToSize(rx.instructions, pageWidth - 36);
    const boxH = Math.max(14, instrLines.length * 4.5 + 8);
    doc.roundedRect(14, y, pageWidth - 28, boxH, 2, 2, 'FD');
    doc.setTextColor(153, 27, 27);
    doc.setFontSize(9);
    doc.text(instrLines, 18, y + 6);
    y += boxH + 10;
  }

  // Signature block
  const sigY = Math.max(y + 18, 240);
  doc.setDrawColor(148, 163, 184);
  doc.line(pageWidth / 2 - 42, sigY, pageWidth / 2 + 42, sigY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(rx.vet_name, pageWidth / 2, sigY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(rx.vet_reg, pageWidth / 2, sigY + 10, { align: 'center' });

  doc.save(`receta_${pet.name.toLowerCase()}_${rx.id}.pdf`);
}

export function downloadVaccinesPdf(
  pet: Pet,
  vaccines: VaccineRecord[],
  store: Store,
  lang: AppLanguage,
  mode: AppMode,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addClinicHeader(doc, store, mode);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 118, 110);
  doc.text(lang === 'pt-BR' ? `Carteira Digital de Vacinas — ${pet.name}` : `Carnet Digital de Vacunas — ${pet.name}`, 14, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tutor: ${pet.tutor_name || '—'} · ${pet.breed} · ${pet.weight_kg} kg`, 14, y);
  y += 10;

  vaccines.forEach((v) => {
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, y, pageWidth - 28, 18, 2, 2, 'D');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${v.vaccine_name} (${v.dose_number})`, 18, y + 6.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${lang === 'pt-BR' ? 'Aplicada' : 'Aplicada'}: ${formatDateShort(v.applied_date, lang)} · ${
        lang === 'pt-BR' ? 'Próxima' : 'Próximo refuerzo'
      }: ${formatDateShort(v.next_due_date, lang)} · Lote: ${v.batch_code} (${v.manufacturer})`,
      18,
      y + 12.5,
    );
    y += 22;
  });

  doc.save(`vacunas_${pet.name.toLowerCase()}.pdf`);
}

export function downloadClinicalDocPdf(
  docItem: ClinicalDocument,
  pet: Pet,
  store: Store,
  lang: AppLanguage,
  mode: AppMode,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addClinicHeader(doc, store, mode);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 118, 110);
  doc.text(docItem.title, 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Paciente: ${pet.name} (${pet.breed}, ${pet.weight_kg} kg) · Tutor: ${pet.tutor_name || '—'} · ${formatDateShort(docItem.created_at, lang)}`,
    14,
    y,
  );
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const lines = doc.splitTextToSize(docItem.content, pageWidth - 28);
  doc.text(lines, 14, y);

  doc.save(`documento_${pet.name.toLowerCase()}_${docItem.id}.pdf`);
}

export function downloadHospitalBulletinPdf(
  hosp: Hospitalization,
  store: Store,
  lang: AppLanguage,
  mode: AppMode,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addClinicHeader(doc, store, mode);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 118, 110);
  doc.text(
    lang === 'pt-BR' ? `Boletim de Internação — ${hosp.pet_name}` : `Boletín de Internación — ${hosp.pet_name}`,
    14,
    y,
  );
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Box: ${hosp.box_code} · Veterinario: ${hosp.attending_vet}`, 14, y);
  y += 7;
  const planLines = doc.splitTextToSize(`Plan: ${hosp.care_plan}`, pageWidth - 28);
  doc.text(planLines, 14, y);
  y += planLines.length * 5 + 6;

  doc.setFont('helvetica', 'bold');
  doc.text(lang === 'pt-BR' ? 'Evolução de Plantão:' : 'Evolución de Guardia:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  hosp.notes.forEach((n) => {
    const lines = doc.splitTextToSize(`[${formatDateShort(n.created_at, lang)}] ${n.author_name}: ${n.note}`, pageWidth - 28);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 3;
  });

  doc.save(`boletin_${(hosp.pet_name || 'paciente').toLowerCase()}.pdf`);
}

export function downloadFinanceReportPdf(
  entries: FinancialEntry[],
  store: Store,
  lang: AppLanguage,
  mode: AppMode,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = addClinicHeader(doc, store, mode);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 118, 110);
  doc.text(lang === 'pt-BR' ? 'Relatório Financeiro & Fluxo de Caixa' : 'Reporte Financiero & Flujo de Caja', 14, y);
  y += 9;

  entries.slice(0, 28).forEach((e) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${formatDateShort(e.due_date, lang)} · ${e.category} · ${e.description}`, 14, y);
    doc.setTextColor(e.type === 'income' ? 22 : 185, e.type === 'income' ? 163 : 28, e.type === 'income' ? 74 : 28);
    doc.text(
      `${e.type === 'income' ? '+' : '-'}${formatCurrency(e.amount, store.currency)}`,
      pageWidth - 14,
      y,
      { align: 'right' },
    );
    y += 6;
  });

  doc.save(`reporte_financiero_${store.code.toLowerCase()}.pdf`);
}

export function downloadExcelCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
  const csvContent =
    '\uFEFF' + [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
