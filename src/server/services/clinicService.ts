import type { DatabaseSync } from 'node:sqlite';
import type { AppLanguage, UserRole } from '../../shared/types.ts';

export interface ActorContext {
  userId?: number | null;
  userName: string;
  userRole: UserRole;
  lang: AppLanguage;
}

export class DomainError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function msg(lang: AppLanguage, es: string, pt: string): string {
  return lang === 'pt-BR' ? pt : es;
}

export function assertRole(actor: ActorContext, allowed: UserRole[]) {
  if (!allowed.includes(actor.userRole)) {
    throw new DomainError(
      403,
      msg(
        actor.lang,
        `El perfil "${actor.userRole}" no tiene permiso para esta acción.`,
        `O perfil "${actor.userRole}" não tem permissão para esta ação.`,
      ),
    );
  }
}

export function writeAuditLog(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  action: string,
  entityType: string,
  entityId: string | number,
  details: Record<string, unknown>,
) {
  db.prepare(`
    INSERT INTO audit_logs (store_id, user_id, user_name, user_role, action, entity_type, entity_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    storeId,
    actor.userId ?? null,
    actor.userName,
    actor.userRole,
    action,
    entityType,
    String(entityId),
    JSON.stringify(details),
    new Date().toISOString(),
  );
}

export function createTutor(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    name: string;
    document: string;
    phone: string;
    email?: string;
    address?: string;
    notes?: string;
    lgpd_consent?: boolean;
    credit_limit?: number;
  },
) {
  assertRole(actor, ['reception', 'vet', 'manager']);
  if (!input.name?.trim() || !input.phone?.trim() || !input.document?.trim()) {
    throw new DomainError(
      400,
      msg(
        actor.lang,
        'Nombre, documento y teléfono son obligatorios para registrar al tutor.',
        'Nome, documento e telefone são obrigatórios para cadastrar o tutor.',
      ),
    );
  }
  const now = new Date().toISOString();
  const consent = input.lgpd_consent !== false ? 1 : 0;
  const res = db.prepare(`
    INSERT INTO tutors (store_id, name, document, phone, email, address, notes, lgpd_consent, lgpd_consent_at, credit_limit, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    storeId,
    input.name.trim(),
    input.document.trim(),
    input.phone.trim(),
    input.email?.trim() || null,
    input.address?.trim() || null,
    input.notes?.trim() || null,
    consent,
    consent ? now : null,
    Number(input.credit_limit ?? 0),
    now,
  );
  const id = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'CREATE_TUTOR', 'tutor', id, { name: input.name });
  return db.prepare('SELECT * FROM tutors WHERE id = ?').get(id);
}

export function createPet(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    tutor_id: number;
    name: string;
    species: 'dog' | 'cat' | 'other';
    breed: string;
    sex: 'M' | 'F';
    birth_date: string;
    weight_kg: number;
    microchip?: string;
    photo_url?: string;
    neutered?: boolean;
    allergies?: string;
    chronic_conditions?: string;
    temperament?: string;
  },
) {
  assertRole(actor, ['reception', 'vet', 'groomer', 'manager']);
  if (!input.tutor_id || !input.name?.trim() || !input.breed?.trim()) {
    throw new DomainError(
      400,
      msg(
        actor.lang,
        'Tutor, nombre del pet y raza son obligatorios.',
        'Tutor, nome do pet e raça são obrigatórios.',
      ),
    );
  }
  const tutor = db.prepare('SELECT id FROM tutors WHERE id = ? AND store_id = ?').get(input.tutor_id, storeId);
  if (!tutor) {
    throw new DomainError(404, msg(actor.lang, 'Tutor no encontrado.', 'Tutor não encontrado.'));
  }

  const now = new Date().toISOString();
  const weight = Number(input.weight_kg || 0);
  const res = db.prepare(`
    INSERT INTO pets (
      store_id, tutor_id, name, species, breed, sex, birth_date, weight_kg,
      microchip, photo_url, neutered, allergies, chronic_conditions, temperament, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    storeId,
    input.tutor_id,
    input.name.trim(),
    input.species || 'dog',
    input.breed.trim(),
    input.sex || 'M',
    input.birth_date || '2024-01-01',
    weight,
    input.microchip?.trim() || null,
    input.photo_url || null,
    input.neutered ? 1 : 0,
    input.allergies?.trim() || null,
    input.chronic_conditions?.trim() || null,
    input.temperament?.trim() || null,
    now,
  );
  const petId = Number(res.lastInsertRowid);
  if (weight > 0) {
    db.prepare('INSERT INTO pet_weights (pet_id, weight_kg, recorded_at, recorded_by) VALUES (?, ?, ?, ?)').run(
      petId,
      weight,
      now,
      actor.userName,
    );
  }
  writeAuditLog(db, storeId, actor, 'CREATE_PET', 'pet', petId, { name: input.name, tutor_id: input.tutor_id });
  return db.prepare('SELECT * FROM pets WHERE id = ?').get(petId);
}

export function deletePetForbidden(actor: ActorContext): never {
  throw new DomainError(
    403,
    msg(
      actor.lang,
      'Los pacientes no pueden eliminarse porque poseen historial clínico inmutable.',
      'Pacientes não podem ser apagados pois possuem histórico clínico imutável.',
    ),
  );
}

export function exportTutorLgpdData(db: DatabaseSync, storeId: number, tutorId: number, actor: ActorContext) {
  assertRole(actor, ['reception', 'manager', 'tutor']);
  const tutor = db.prepare('SELECT * FROM tutors WHERE id = ? AND store_id = ?').get(tutorId, storeId);
  if (!tutor) {
    throw new DomainError(404, msg(actor.lang, 'Tutor no encontrado.', 'Tutor não encontrado.'));
  }
  const pets = db.prepare('SELECT * FROM pets WHERE tutor_id = ?').all(tutorId);
  const comandas = db.prepare('SELECT * FROM comandas WHERE tutor_id = ?').all(tutorId);
  writeAuditLog(db, storeId, actor, 'LGPD_EXPORT', 'tutor', tutorId, { tutorId });
  return { exported_at: new Date().toISOString(), tutor, pets, comandas };
}

export function anonymizeTutorLgpd(db: DatabaseSync, storeId: number, tutorId: number, actor: ActorContext) {
  assertRole(actor, ['manager']);
  const tutor = db.prepare('SELECT * FROM tutors WHERE id = ? AND store_id = ?').get(tutorId, storeId);
  if (!tutor) {
    throw new DomainError(404, msg(actor.lang, 'Tutor no encontrado.', 'Tutor não encontrado.'));
  }
  db.prepare(`
    UPDATE tutors
    SET name = ?, document = '***ANON***', phone = '***ANON***', email = NULL, address = NULL, notes = 'Anonimizado LGPD', anonymized = 1
    WHERE id = ?
  `).run(`Tutor Anonimizado #${tutorId}`, tutorId);
  writeAuditLog(db, storeId, actor, 'LGPD_ANONYMIZE', 'tutor', tutorId, { tutorId });
  return db.prepare('SELECT * FROM tutors WHERE id = ?').get(tutorId);
}

export function createAppointment(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    pet_id: number;
    tutor_id: number;
    professional_id: number;
    service_id?: number | null;
    type: 'consulta' | 'retorno' | 'vacina' | 'banho_tosa' | 'cirurgia' | 'hotel_creche';
    start_time: string;
    end_time: string;
    notes?: string;
    is_squeeze_in?: boolean;
  },
) {
  assertRole(actor, ['reception', 'vet', 'groomer', 'manager', 'tutor']);
  if (!input.pet_id || !input.tutor_id || !input.professional_id || !input.start_time || !input.end_time) {
    throw new DomainError(
      400,
      msg(actor.lang, 'Complete pet, profesional y horario.', 'Preencha pet, profissional e horário.'),
    );
  }
  if (!input.is_squeeze_in) {
    const conflict = db
      .prepare(`
        SELECT id FROM appointments
        WHERE store_id = ? AND professional_id = ? AND status != 'cancelled'
          AND start_time < ? AND end_time > ?
      `)
      .get(storeId, input.professional_id, input.end_time, input.start_time);
    if (conflict) {
      throw new DomainError(
        409,
        msg(
          actor.lang,
          'Conflicto de horario detectado para este profesional. Active "Encaje" para confirmar igualmente.',
          'Conflito de horário detectado para este profissional. Marque "Encaixe" para confirmar.',
        ),
      );
    }
  }
  const res = db
    .prepare(`
      INSERT INTO appointments (store_id, pet_id, tutor_id, professional_id, service_id, type, start_time, end_time, status, notes, is_squeeze_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)
    `)
    .run(
      storeId,
      input.pet_id,
      input.tutor_id,
      input.professional_id,
      input.service_id ?? null,
      input.type,
      input.start_time,
      input.end_time,
      input.notes?.trim() || null,
      input.is_squeeze_in ? 1 : 0,
    );
  const id = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'CREATE_APPOINTMENT', 'appointment', id, { start_time: input.start_time, type: input.type });
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id);
}

export function updateAppointmentStatus(
  db: DatabaseSync,
  storeId: number,
  appointmentId: number,
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled',
  actor: ActorContext,
) {
  assertRole(actor, ['reception', 'vet', 'groomer', 'manager']);
  const existing = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND store_id = ?')
    .get(appointmentId, storeId) as { id: number; queue_ticket: string | null; type: string } | undefined;
  if (!existing) {
    throw new DomainError(404, msg(actor.lang, 'Turno no encontrado.', 'Agendamento não encontrado.'));
  }

  let ticket = existing.queue_ticket;
  if (status === 'checked_in' && !ticket) {
    const prefix = existing.type === 'banho_tosa' ? 'B' : 'A';
    const count = (
      db.prepare("SELECT COUNT(*) as c FROM appointments WHERE store_id = ? AND queue_ticket IS NOT NULL").get(storeId) as {
        c: number;
      }
    ).c;
    ticket = `${prefix}-${String(count + 1).padStart(2, '0')}`;
  }

  db.prepare('UPDATE appointments SET status = ?, queue_ticket = ? WHERE id = ?').run(status, ticket, appointmentId);
  writeAuditLog(db, storeId, actor, 'UPDATE_APPOINTMENT_STATUS', 'appointment', appointmentId, { status, ticket });
  return db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId);
}

export function createConsultation(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    pet_id: number;
    vet_id?: number | null;
    vet_name?: string;
    vet_reg?: string;
    appointment_id?: number | null;
    subjective: string;
    objective_exam: string;
    temp_c?: number | null;
    heart_rate?: number | null;
    resp_rate?: number | null;
    weight_kg?: number | null;
    assessment_dx: string;
    cid_vet?: string;
    plan_conduct: string;
    return_date?: string | null;
  },
) {
  assertRole(actor, ['vet', 'manager']);
  if (!input.pet_id || !input.subjective?.trim() || !input.objective_exam?.trim() || !input.assessment_dx?.trim() || !input.plan_conduct?.trim()) {
    throw new DomainError(
      400,
      msg(
        actor.lang,
        'Los campos SOAP (Subjetivo, Objetivo, Evaluación y Plan) son obligatorios.',
        'Os campos SOAP (Subjetivo, Objetivo, Avaliação e Plano) são obrigatórios.',
      ),
    );
  }
  const pet = db.prepare('SELECT id, weight_kg FROM pets WHERE id = ? AND store_id = ?').get(input.pet_id, storeId) as
    | { id: number; weight_kg: number }
    | undefined;
  if (!pet) {
    throw new DomainError(404, msg(actor.lang, 'Paciente no encontrado.', 'Paciente não encontrado.'));
  }

  const now = new Date().toISOString();
  const vetName = input.vet_name?.trim() || actor.userName;
  const vetReg = input.vet_reg?.trim() || 'SENACSA-VET 0482-PY';
  const weight = input.weight_kg && input.weight_kg > 0 ? Number(input.weight_kg) : pet.weight_kg;

  db.exec('BEGIN;');
  try {
    const res = db
      .prepare(`
        INSERT INTO consultations (
          store_id, pet_id, vet_id, vet_name, vet_reg, appointment_id, visit_date,
          subjective, objective_exam, temp_c, heart_rate, resp_rate, weight_kg,
          assessment_dx, cid_vet, plan_conduct, return_date, signed_at, is_locked
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `)
      .run(
        storeId,
        input.pet_id,
        input.vet_id ?? actor.userId ?? null,
        vetName,
        vetReg,
        input.appointment_id ?? null,
        now,
        input.subjective.trim(),
        input.objective_exam.trim(),
        input.temp_c ?? null,
        input.heart_rate ?? null,
        input.resp_rate ?? null,
        weight,
        input.assessment_dx.trim(),
        input.cid_vet?.trim() || null,
        input.plan_conduct.trim(),
        input.return_date || null,
        now,
      );
    const consultId = Number(res.lastInsertRowid);

    if (input.weight_kg && input.weight_kg > 0) {
      db.prepare('UPDATE pets SET weight_kg = ? WHERE id = ?').run(weight, input.pet_id);
      db.prepare('INSERT INTO pet_weights (pet_id, weight_kg, recorded_at, recorded_by) VALUES (?, ?, ?, ?)').run(
        input.pet_id,
        weight,
        now,
        vetName,
      );
    }

    writeAuditLog(db, storeId, actor, 'CREATE_CONSULTATION', 'consultation', consultId, {
      pet_id: input.pet_id,
      assessment_dx: input.assessment_dx,
    });
    db.exec('COMMIT;');
    return db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultId);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function addConsultationAddendum(
  db: DatabaseSync,
  storeId: number,
  consultationId: number,
  actor: ActorContext,
  note: string,
) {
  assertRole(actor, ['vet', 'manager']);
  if (!note?.trim()) {
    throw new DomainError(
      400,
      msg(actor.lang, 'El texto del adendo no puede estar vacío.', 'O texto do adendo não pode ficar vazio.'),
    );
  }
  const consult = db
    .prepare('SELECT id, pet_id FROM consultations WHERE id = ? AND store_id = ?')
    .get(consultationId, storeId);
  if (!consult) {
    throw new DomainError(404, msg(actor.lang, 'Consulta no encontrada.', 'Consulta não encontrada.'));
  }
  const now = new Date().toISOString();
  const res = db
    .prepare(`
      INSERT INTO consultation_addenda (consultation_id, author_id, author_name, author_role, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(consultationId, actor.userId ?? null, actor.userName, actor.userRole, note.trim(), now);
  const addendumId = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'ADD_ADDENDUM', 'consultation', consultationId, { addendum_id: addendumId });
  return db.prepare('SELECT * FROM consultation_addenda WHERE id = ?').get(addendumId);
}

export function updateConsultationForbidden(actor: ActorContext): never {
  throw new DomainError(
    403,
    msg(
      actor.lang,
      'La historia clínica es inmutable. Para corregir o agregar datos utilice un Adendo.',
      'O prontuário é imutável. Para corrigir ou complementar, registre um Adendo.',
    ),
  );
}

export function createPrescription(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    consultation_id: number;
    pet_id: number;
    vet_name?: string;
    vet_reg?: string;
    type: 'normal' | 'controlled';
    valid_until: string;
    instructions?: string;
    items: Array<{
      medication_name: string;
      dose_mg_kg?: number | null;
      calculated_dose: string;
      route: string;
      frequency: string;
      duration_days: number;
      quantity_text: string;
    }>;
  },
) {
  assertRole(actor, ['vet', 'manager']);
  if (!input.consultation_id || !input.pet_id || !input.items?.length) {
    throw new DomainError(
      400,
      msg(actor.lang, 'Agregue al menos un medicamento a la receta.', 'Adicione ao menos um medicamento à receita.'),
    );
  }
  const pet = db
    .prepare('SELECT id, allergies FROM pets WHERE id = ? AND store_id = ?')
    .get(input.pet_id, storeId) as { id: number; allergies: string | null } | undefined;
  if (!pet) {
    throw new DomainError(404, msg(actor.lang, 'Paciente no encontrado.', 'Paciente não encontrado.'));
  }

  // Safety check against documented allergies!
  if (pet.allergies) {
    const allergyLower = pet.allergies.toLowerCase();
    for (const item of input.items) {
      const medLower = item.medication_name.toLowerCase();
      if (allergyLower.includes('dipirona') && (medLower.includes('dipirona') || medLower.includes('metamizol'))) {
        throw new DomainError(
          400,
          msg(
            actor.lang,
            `BLOQUEO CLÍNICO DE SEGURIDAD: El paciente posee alergia documentada a Dipirona (${pet.allergies}).`,
            `BLOQUEIO CLÍNICO DE SEGURANÇA: O paciente possui alergia documentada a Dipirona (${pet.allergies}).`,
          ),
        );
      }
    }
  }

  const now = new Date().toISOString();
  db.exec('BEGIN;');
  try {
    const res = db
      .prepare(`
        INSERT INTO prescriptions (consultation_id, pet_id, vet_name, vet_reg, type, valid_until, instructions, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        input.consultation_id,
        input.pet_id,
        input.vet_name || actor.userName,
        input.vet_reg || 'SENACSA-VET 0482-PY',
        input.type || 'normal',
        input.valid_until,
        input.instructions?.trim() || null,
        now,
      );
    const rxId = Number(res.lastInsertRowid);
    const insItem = db.prepare(`
      INSERT INTO prescription_items (prescription_id, medication_name, dose_mg_kg, calculated_dose, route, frequency, duration_days, quantity_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const it of input.items) {
      insItem.run(
        rxId,
        it.medication_name.trim(),
        it.dose_mg_kg ?? null,
        it.calculated_dose.trim(),
        it.route.trim(),
        it.frequency.trim(),
        Number(it.duration_days || 1),
        it.quantity_text.trim(),
      );
    }
    writeAuditLog(db, storeId, actor, 'CREATE_PRESCRIPTION', 'prescription', rxId, {
      pet_id: input.pet_id,
      type: input.type,
    });
    db.exec('COMMIT;');
    const rx = db.prepare('SELECT * FROM prescriptions WHERE id = ?').get(rxId) as Record<string, unknown>;
    const items = db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rxId);
    return { ...rx, items };
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function createClinicalDocument(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    pet_id: number;
    consultation_id?: number | null;
    doc_type: 'certificate' | 'report' | 'surgical_consent' | 'exam_pdf';
    title: string;
    content: string;
    file_url?: string | null;
    released_to_tutor?: boolean;
  },
) {
  assertRole(actor, ['vet', 'manager']);
  if (!input.pet_id || !input.title?.trim() || !input.content?.trim()) {
    throw new DomainError(400, msg(actor.lang, 'Título y contenido son obligatorios.', 'Título e conteúdo são obrigatórios.'));
  }
  const now = new Date().toISOString();
  const res = db
    .prepare(`
      INSERT INTO clinical_documents (store_id, pet_id, consultation_id, doc_type, title, content, file_url, released_to_tutor, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      storeId,
      input.pet_id,
      input.consultation_id ?? null,
      input.doc_type,
      input.title.trim(),
      input.content.trim(),
      input.file_url || null,
      input.released_to_tutor ? 1 : 0,
      actor.userName,
      now,
    );
  const id = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'CREATE_DOCUMENT', 'clinical_document', id, { doc_type: input.doc_type, title: input.title });
  return db.prepare('SELECT * FROM clinical_documents WHERE id = ?').get(id);
}

export function toggleDocumentRelease(db: DatabaseSync, storeId: number, docId: number, released: boolean, actor: ActorContext) {
  assertRole(actor, ['vet', 'manager']);
  db.prepare('UPDATE clinical_documents SET released_to_tutor = ? WHERE id = ? AND store_id = ?').run(released ? 1 : 0, docId, storeId);
  writeAuditLog(db, storeId, actor, 'RELEASE_DOCUMENT', 'clinical_document', docId, { released });
  return db.prepare('SELECT * FROM clinical_documents WHERE id = ?').get(docId);
}

export function applyVaccine(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    pet_id: number;
    protocol_code: string;
    vaccine_name: string;
    dose_number: string;
    applied_date: string;
    next_due_date: string;
    batch_code: string;
    manufacturer: string;
    vet_name?: string;
    vet_reg?: string;
  },
) {
  assertRole(actor, ['vet', 'manager']);
  if (!input.pet_id || !input.vaccine_name?.trim() || !input.batch_code?.trim() || !input.next_due_date) {
    throw new DomainError(
      400,
      msg(
        actor.lang,
        'Vacuna, lote y fecha del próximo refuerzo son obligatorios.',
        'Vacina, lote e data do próximo reforço são obrigatórios.',
      ),
    );
  }
  const res = db
    .prepare(`
      INSERT INTO vaccines (store_id, pet_id, protocol_code, vaccine_name, dose_number, applied_date, next_due_date, batch_code, manufacturer, vet_name, vet_reg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      storeId,
      input.pet_id,
      input.protocol_code || 'CUSTOM',
      input.vaccine_name.trim(),
      input.dose_number.trim() || 'Dosis única',
      input.applied_date,
      input.next_due_date,
      input.batch_code.trim(),
      input.manufacturer.trim() || 'Laboratorio Vet',
      input.vet_name || actor.userName,
      input.vet_reg || 'SENACSA-VET 0482-PY',
    );
  const id = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'APPLY_VACCINE', 'vaccine', id, {
    pet_id: input.pet_id,
    vaccine: input.vaccine_name,
    next_due_date: input.next_due_date,
  });
  return db.prepare('SELECT * FROM vaccines WHERE id = ?').get(id);
}

export function markVaccineReminded(db: DatabaseSync, storeId: number, vaccineId: number, note: string, actor: ActorContext) {
  assertRole(actor, ['reception', 'vet', 'manager']);
  const now = new Date().toISOString();
  db.prepare('UPDATE vaccines SET reminded_at = ?, reminded_note = ? WHERE id = ? AND store_id = ?').run(
    now,
    note || 'WhatsApp enviado',
    vaccineId,
    storeId,
  );
  writeAuditLog(db, storeId, actor, 'VACCINE_REMINDER', 'vaccine', vaccineId, { note });
  return db.prepare('SELECT * FROM vaccines WHERE id = ?').get(vaccineId);
}

export function createGroomingOrder(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    pet_id: number;
    tutor_id: number;
    service_id: number;
    groomer_name?: string;
    taxi_dog?: boolean;
    taxi_fee?: number;
    package_id?: number | null;
    notes?: string;
  },
) {
  assertRole(actor, ['reception', 'groomer', 'manager']);
  const now = new Date().toISOString();
  const res = db
    .prepare(`
      INSERT INTO grooming_orders (store_id, pet_id, tutor_id, service_id, groomer_name, status, taxi_dog, taxi_fee, package_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'scheduled', ?, ?, ?, ?, ?)
    `)
    .run(
      storeId,
      input.pet_id,
      input.tutor_id,
      input.service_id,
      input.groomer_name || 'Diego Acosta (Ejemplo)',
      input.taxi_dog ? 1 : 0,
      input.taxi_dog ? Number(input.taxi_fee ?? 35000) : 0,
      input.package_id ?? null,
      input.notes?.trim() || null,
      now,
    );
  const id = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'CREATE_GROOMING', 'grooming_order', id, { pet_id: input.pet_id });
  return db.prepare('SELECT * FROM grooming_orders WHERE id = ?').get(id);
}

export function updateGroomingStatus(
  db: DatabaseSync,
  storeId: number,
  orderId: number,
  status: 'scheduled' | 'in_progress' | 'ready' | 'delivered',
  actor: ActorContext,
  photoReadyUrl?: string,
) {
  assertRole(actor, ['reception', 'groomer', 'manager']);
  const order = db
    .prepare('SELECT * FROM grooming_orders WHERE id = ? AND store_id = ?')
    .get(orderId, storeId) as
    | { id: number; status: string; package_id: number | null; pet_id: number; photo_ready_url: string | null }
    | undefined;
  if (!order) {
    throw new DomainError(404, msg(actor.lang, 'Orden de baño no encontrada.', 'Ordem de banho não encontrada.'));
  }

  db.exec('BEGIN;');
  try {
    let finalPhoto = photoReadyUrl || order.photo_ready_url;
    if (status === 'ready' && !finalPhoto) {
      const pet = db.prepare('SELECT photo_url FROM pets WHERE id = ?').get(order.pet_id) as { photo_url: string | null } | undefined;
      finalPhoto = pet?.photo_url || null;
    }

    // Automatically deduct package session when moving to delivered for the first time
    if (status === 'delivered' && order.status !== 'delivered' && order.package_id) {
      db.prepare(`
        UPDATE packages
        SET used_sessions = CASE WHEN used_sessions < total_sessions THEN used_sessions + 1 ELSE used_sessions END
        WHERE id = ?
      `).run(order.package_id);
    }

    db.prepare('UPDATE grooming_orders SET status = ?, photo_ready_url = ? WHERE id = ?').run(status, finalPhoto, orderId);
    writeAuditLog(db, storeId, actor, 'UPDATE_GROOMING_STATUS', 'grooming_order', orderId, { status });
    db.exec('COMMIT;');
    return db.prepare('SELECT * FROM grooming_orders WHERE id = ?').get(orderId);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function sendGroomingToComanda(db: DatabaseSync, storeId: number, orderId: number, actor: ActorContext) {
  assertRole(actor, ['reception', 'groomer', 'manager']);
  const order = db
    .prepare(`
      SELECT g.*, s.name_es, s.name_pt, s.price as service_price
      FROM grooming_orders g
      JOIN services s ON s.id = g.service_id
      WHERE g.id = ? AND g.store_id = ?
    `)
    .get(orderId, storeId) as
    | {
        id: number;
        pet_id: number;
        tutor_id: number;
        service_id: number;
        name_es: string;
        name_pt: string;
        service_price: number;
        taxi_dog: number;
        taxi_fee: number;
        package_id: number | null;
        comanda_id: number | null;
      }
    | undefined;
  if (!order) {
    throw new DomainError(404, msg(actor.lang, 'Orden no encontrada.', 'Ordem não encontrada.'));
  }
  if (order.comanda_id) {
    return db.prepare('SELECT * FROM comandas WHERE id = ?').get(order.comanda_id);
  }

  db.exec('BEGIN;');
  try {
    let comanda = db
      .prepare("SELECT * FROM comandas WHERE store_id = ? AND tutor_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1")
      .get(storeId, order.tutor_id) as { id: number } | undefined;

    if (!comanda) {
      const cRes = db
        .prepare("INSERT INTO comandas (store_id, tutor_id, pet_id, status, subtotal, discount, total, created_at) VALUES (?, ?, ?, 'open', 0, 0, 0, ?)")
        .run(storeId, order.tutor_id, order.pet_id, new Date().toISOString());
      comanda = { id: Number(cRes.lastInsertRowid) };
    }

    const svcPrice = order.package_id ? 0 : order.service_price;
    const svcDesc = order.package_id
      ? `${actor.lang === 'pt-BR' ? order.name_pt : order.name_es} (Pacote)`
      : actor.lang === 'pt-BR'
        ? order.name_pt
        : order.name_es;

    db.prepare(`
      INSERT INTO comanda_items (comanda_id, item_type, ref_id, description, qty, unit_price, total_price)
      VALUES (?, 'service', ?, ?, 1, ?, ?)
    `).run(comanda.id, order.service_id, svcDesc, svcPrice, svcPrice);

    if (order.taxi_dog && order.taxi_fee > 0) {
      db.prepare(`
        INSERT INTO comanda_items (comanda_id, item_type, ref_id, description, qty, unit_price, total_price)
        VALUES (?, 'taxi', NULL, 'Táxi Dog', 1, ?, ?)
      `).run(comanda.id, order.taxi_fee, order.taxi_fee);
    }

    recalcComandaTotals(db, comanda.id);
    db.prepare('UPDATE grooming_orders SET comanda_id = ? WHERE id = ?').run(comanda.id, orderId);
    writeAuditLog(db, storeId, actor, 'GROOMING_TO_COMANDA', 'grooming_order', orderId, { comanda_id: comanda.id });
    db.exec('COMMIT;');
    return getComandaWithItems(db, comanda.id);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function recalcComandaTotals(db: DatabaseSync, comandaId: number) {
  const row = db
    .prepare('SELECT COALESCE(SUM(total_price), 0) as sub FROM comanda_items WHERE comanda_id = ?')
    .get(comandaId) as { sub: number };
  const comanda = db.prepare('SELECT discount FROM comandas WHERE id = ?').get(comandaId) as { discount: number };
  const subtotal = row.sub;
  const total = Math.max(0, subtotal - (comanda?.discount || 0));
  db.prepare('UPDATE comandas SET subtotal = ?, total = ? WHERE id = ?').run(subtotal, total, comandaId);
}

export function getComandaWithItems(db: DatabaseSync, comandaId: number) {
  const comanda = db
    .prepare(`
      SELECT c.*, t.name as tutor_name, t.phone as tutor_phone, t.credit_limit as tutor_credit_limit, p.name as pet_name
      FROM comandas c
      JOIN tutors t ON t.id = c.tutor_id
      LEFT JOIN pets p ON p.id = c.pet_id
      WHERE c.id = ?
    `)
    .get(comandaId) as Record<string, unknown> | undefined;
  if (!comanda) return null;
  const items = db.prepare('SELECT * FROM comanda_items WHERE comanda_id = ? ORDER BY id ASC').all(comandaId);
  return { ...comanda, items };
}

export function createComanda(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: { tutor_id: number; pet_id?: number | null },
) {
  assertRole(actor, ['reception', 'vet', 'groomer', 'manager']);
  if (!input.tutor_id) {
    throw new DomainError(400, msg(actor.lang, 'Seleccione un tutor.', 'Selecione um tutor.'));
  }
  const res = db
    .prepare("INSERT INTO comandas (store_id, tutor_id, pet_id, status, subtotal, discount, total, created_at) VALUES (?, ?, ?, 'open', 0, 0, 0, ?)")
    .run(storeId, input.tutor_id, input.pet_id ?? null, new Date().toISOString());
  const id = Number(res.lastInsertRowid);
  writeAuditLog(db, storeId, actor, 'CREATE_COMANDA', 'comanda', id, { tutor_id: input.tutor_id });
  return getComandaWithItems(db, id);
}

export function addComandaItem(
  db: DatabaseSync,
  storeId: number,
  comandaId: number,
  actor: ActorContext,
  input: {
    item_type: 'service' | 'product' | 'vaccine' | 'hospitalization' | 'taxi';
    ref_id?: number | null;
    description?: string;
    qty: number;
    unit_price?: number;
  },
) {
  assertRole(actor, ['reception', 'vet', 'groomer', 'manager']);
  const comanda = db
    .prepare("SELECT * FROM comandas WHERE id = ? AND store_id = ? AND status = 'open'")
    .get(comandaId, storeId);
  if (!comanda) {
    throw new DomainError(404, msg(actor.lang, 'Comanda abierta no encontrada.', 'Comanda aberta não encontrada.'));
  }

  const qty = Math.max(1, Number(input.qty || 1));
  let description = input.description?.trim() || '';
  let unitPrice = Number(input.unit_price ?? 0);

  if (input.item_type === 'product' && input.ref_id) {
    const prod = db.prepare('SELECT * FROM products WHERE id = ? AND store_id = ?').get(input.ref_id, storeId) as
      | { id: number; name_es: string; name_pt: string; price: number; stock_qty: number }
      | undefined;
    if (!prod) {
      throw new DomainError(404, msg(actor.lang, 'Producto no encontrado.', 'Produto não encontrado.'));
    }
    if (prod.stock_qty < qty) {
      throw new DomainError(
        400,
        msg(
          actor.lang,
          `Stock insuficiente para "${prod.name_es}" (disponible: ${prod.stock_qty}).`,
          `Estoque insuficiente para "${prod.name_pt}" (disponível: ${prod.stock_qty}).`,
        ),
      );
    }
    description = description || (actor.lang === 'pt-BR' ? prod.name_pt : prod.name_es);
    unitPrice = prod.price;
  } else if (input.item_type === 'service' && input.ref_id) {
    const svc = db.prepare('SELECT * FROM services WHERE id = ? AND store_id = ?').get(input.ref_id, storeId) as
      | { id: number; name_es: string; name_pt: string; price: number }
      | undefined;
    if (!svc) {
      throw new DomainError(404, msg(actor.lang, 'Servicio no encontrado.', 'Serviço não encontrado.'));
    }
    description = description || (actor.lang === 'pt-BR' ? svc.name_pt : svc.name_es);
    unitPrice = svc.price;
  }

  if (!description) {
    throw new DomainError(400, msg(actor.lang, 'Descripción obligatoria.', 'Descrição obrigatória.'));
  }

  const totalPrice = qty * unitPrice;
  db.prepare(`
    INSERT INTO comanda_items (comanda_id, item_type, ref_id, description, qty, unit_price, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(comandaId, input.item_type, input.ref_id ?? null, description, qty, unitPrice, totalPrice);

  recalcComandaTotals(db, comandaId);
  return getComandaWithItems(db, comandaId);
}

export function checkoutComanda(
  db: DatabaseSync,
  storeId: number,
  comandaId: number,
  actor: ActorContext,
  input: {
    payment_method: 'pix' | 'card' | 'cash' | 'fiado';
    discount?: number;
  },
) {
  assertRole(actor, ['reception', 'manager']);
  const comanda = db
    .prepare("SELECT * FROM comandas WHERE id = ? AND store_id = ? AND status = 'open'")
    .get(comandaId, storeId) as { id: number; tutor_id: number; subtotal: number } | undefined;
  if (!comanda) {
    throw new DomainError(404, msg(actor.lang, 'Comanda abierta no encontrada.', 'Comanda aberta não encontrada.'));
  }

  const items = db.prepare('SELECT * FROM comanda_items WHERE comanda_id = ?').all(comandaId) as Array<{
    id: number;
    item_type: string;
    ref_id: number | null;
    qty: number;
    description: string;
    total_price: number;
  }>;
  if (items.length === 0) {
    throw new DomainError(400, msg(actor.lang, 'Agregue al menos un ítem antes de cobrar.', 'Adicione ao menos um item antes de fechar.'));
  }

  const discount = Math.max(0, Number(input.discount ?? 0));
  const finalTotal = Math.max(0, comanda.subtotal - discount);

  const tutor = db.prepare('SELECT id, name, credit_limit FROM tutors WHERE id = ?').get(comanda.tutor_id) as {
    id: number;
    name: string;
    credit_limit: number;
  };
  const store = db.prepare('SELECT fiscal_mode FROM stores WHERE id = ?').get(storeId) as { fiscal_mode: string };

  if (input.payment_method === 'fiado' && finalTotal > tutor.credit_limit) {
    throw new DomainError(
      400,
      msg(
        actor.lang,
        `El total supera el límite de fiado del tutor (${tutor.credit_limit}).`,
        `O total ultrapassa o limite de fiado do tutor (${tutor.credit_limit}).`,
      ),
    );
  }

  const now = new Date().toISOString();
  const dateOnly = now.slice(0, 10);
  const newStatus = input.payment_method === 'fiado' ? 'fiado' : 'paid';
  const fiscalRef =
    store.fiscal_mode === 'BR_NFCE_NFSE'
      ? `NFCE-PEND-${String(comandaId).padStart(6, '0')}`
      : `PY-DOC-${String(comandaId).padStart(6, '0')}`;

  db.exec('BEGIN;');
  try {
    // Deduct stock automatically for every product item
    for (const item of items) {
      if (item.item_type === 'product' && item.ref_id) {
        const prod = db.prepare('SELECT stock_qty, name_es, name_pt FROM products WHERE id = ?').get(item.ref_id) as
          | { stock_qty: number; name_es: string; name_pt: string }
          | undefined;
        if (!prod || prod.stock_qty < item.qty) {
          throw new DomainError(
            400,
            msg(
              actor.lang,
              `Stock insuficiente para "${prod?.name_es ?? item.description}".`,
              `Estoque insuficiente para "${prod?.name_pt ?? item.description}".`,
            ),
          );
        }
        db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(item.qty, item.ref_id);
      }
    }

    db.prepare(`
      UPDATE comandas
      SET discount = ?, total = ?, status = ?, payment_method = ?, fiscal_ref = ?, paid_at = ?
      WHERE id = ?
    `).run(discount, finalTotal, newStatus, input.payment_method, fiscalRef, now, comandaId);

    db.prepare(`
      INSERT INTO financial_entries (store_id, type, category, description, amount, due_date, paid_date, status, professional_id, commission_pct)
      VALUES (?, 'income', 'PDV / Comanda', ?, ?, ?, ?, ?, NULL, 0)
    `).run(
      storeId,
      `Comanda #${comandaId} — ${tutor.name} (${input.payment_method.toUpperCase()})`,
      finalTotal,
      dateOnly,
      newStatus === 'paid' ? dateOnly : null,
      newStatus === 'paid' ? 'paid' : 'pending',
    );

    writeAuditLog(db, storeId, actor, 'CHECKOUT_COMANDA', 'comanda', comandaId, {
      payment_method: input.payment_method,
      total: finalTotal,
      items_count: items.length,
    });
    db.exec('COMMIT;');
    return getComandaWithItems(db, comandaId);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function executeHospitalTask(
  db: DatabaseSync,
  storeId: number,
  taskId: number,
  actor: ActorContext,
) {
  assertRole(actor, ['vet', 'manager', 'reception']);
  const task = db
    .prepare(`
      SELECT ht.*, h.store_id
      FROM hospitalization_tasks ht
      JOIN hospitalizations h ON h.id = ht.hospitalization_id
      WHERE ht.id = ? AND h.store_id = ?
    `)
    .get(taskId, storeId);
  if (!task) {
    throw new DomainError(404, msg(actor.lang, 'Tarea no encontrada.', 'Tarefa não encontrada.'));
  }
  const now = new Date().toISOString();
  db.prepare("UPDATE hospitalization_tasks SET status = 'done', executed_at = ?, executed_by = ? WHERE id = ?").run(
    now,
    actor.userName,
    taskId,
  );
  writeAuditLog(db, storeId, actor, 'EXECUTE_HOSP_TASK', 'hospitalization_task', taskId, { executed_by: actor.userName });
  return db.prepare('SELECT * FROM hospitalization_tasks WHERE id = ?').get(taskId);
}

export function addHospitalization(
  db: DatabaseSync,
  storeId: number,
  actor: ActorContext,
  input: {
    pet_id: number;
    box_code: string;
    risk_level: 'low' | 'moderate' | 'critical';
    care_plan: string;
    attending_vet?: string;
    first_task_title?: string;
  },
) {
  assertRole(actor, ['vet', 'manager']);
  const now = new Date().toISOString();
  db.exec('BEGIN;');
  try {
    const res = db
      .prepare(`
        INSERT INTO hospitalizations (store_id, pet_id, box_code, risk_level, admitted_at, status, care_plan, attending_vet)
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
      `)
      .run(
        storeId,
        input.pet_id,
        input.box_code.trim() || 'BOX-03',
        input.risk_level || 'moderate',
        now,
        input.care_plan.trim(),
        input.attending_vet || actor.userName,
      );
    const hospId = Number(res.lastInsertRowid);
    if (input.first_task_title?.trim()) {
      const nextHour = new Date(Date.now() + 3600 * 1000).toISOString();
      db.prepare(`
        INSERT INTO hospitalization_tasks (hospitalization_id, title, scheduled_time, frequency_hours, status)
        VALUES (?, ?, ?, 6, 'pending')
      `).run(hospId, input.first_task_title.trim(), nextHour);
    }
    writeAuditLog(db, storeId, actor, 'ADMIT_HOSPITALIZATION', 'hospitalization', hospId, {
      pet_id: input.pet_id,
      box_code: input.box_code,
    });
    db.exec('COMMIT;');
    return db.prepare('SELECT * FROM hospitalizations WHERE id = ?').get(hospId);
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
