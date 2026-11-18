import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import type { AppLanguage, AppMode, UserRole } from './src/shared/types.ts';
import { getDb, resetDemoDatabase } from './src/server/db.ts';
import {
  addComandaItem,
  addConsultationAddendum,
  addHospitalization,
  anonymizeTutorLgpd,
  applyVaccine,
  checkoutComanda,
  createClinicalDocument,
  createComanda,
  createConsultation,
  createGroomingOrder,
  createPet,
  createPrescription,
  createTutor,
  createAppointment,
  deletePetForbidden,
  DomainError,
  executeHospitalTask,
  exportTutorLgpdData,
  getComandaWithItems,
  markVaccineReminded,
  msg,
  sendGroomingToComanda,
  toggleDocumentRelease,
  updateAppointmentStatus,
  updateConsultationForbidden,
  updateGroomingStatus,
  writeAuditLog,
  type ActorContext,
} from './src/server/services/clinicService.ts';

const PORT = 3000;

function getContext(req: Request): { mode: AppMode; storeId: number; actor: ActorContext } {
  const modeHeader = String(req.headers['x-app-mode'] || req.query.mode || 'demo');
  const mode: AppMode = modeHeader === 'prod' ? 'prod' : 'demo';
  const langHeader = String(req.headers['x-app-lang'] || req.query.lang || 'es');
  const lang: AppLanguage = langHeader === 'pt-BR' ? 'pt-BR' : 'es';
  const roleHeader = String(req.headers['x-user-role'] || 'vet') as UserRole;
  const validRoles: UserRole[] = ['reception', 'vet', 'groomer', 'manager', 'tutor'];
  const userRole: UserRole = validRoles.includes(roleHeader) ? roleHeader : 'vet';
  const userName = decodeURIComponent(String(req.headers['x-user-name'] || 'Dra. Fabiele Silva (Ejemplo)'));
  const userIdRaw = Number(req.headers['x-user-id'] || 1);
  const storeIdRaw = Number(req.headers['x-store-id'] || req.query.storeId || 1);

  return {
    mode,
    storeId: Number.isFinite(storeIdRaw) && storeIdRaw > 0 ? storeIdRaw : 1,
    actor: {
      userId: Number.isFinite(userIdRaw) ? userIdRaw : null,
      userName,
      userRole,
      lang,
    },
  };
}

function handleError(res: Response, err: unknown, lang: AppLanguage) {
  if (err instanceof DomainError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error('API Error:', err);
  const message =
    err instanceof Error
      ? err.message
      : msg(lang, 'Error interno del servidor.', 'Erro interno do servidor.');
  return res.status(500).json({ error: message });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // Initialize demo DB eagerly so first mobile request is <50ms
  getDb('demo');

  // --- HEALTH ---
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'vortelopet' });
  });

  // --- DEMO RESET ---
  app.post('/api/demo/reset', (_req, res) => {
    try {
      resetDemoDatabase();
      res.json({ ok: true });
    } catch (err) {
      handleError(res, err, 'es');
    }
  });

  // --- BOOTSTRAP / MULTI-STORE ---
  app.get('/api/bootstrap', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const stores = db.prepare('SELECT * FROM stores ORDER BY id ASC').all();
      const activeStore =
        stores.find((s: any) => s.id === storeId) || stores[0];
      const activeId = (activeStore as any)?.id ?? 1;

      const staff = db.prepare('SELECT * FROM users WHERE store_id = ? ORDER BY id ASC').all(activeId);
      const tutors = db.prepare('SELECT * FROM tutors WHERE store_id = ? ORDER BY id DESC').all(activeId);
      const pets = db
        .prepare(`
          SELECT p.*, t.name as tutor_name, t.phone as tutor_phone
          FROM pets p
          JOIN tutors t ON t.id = p.tutor_id
          WHERE p.store_id = ?
          ORDER BY p.id ASC
        `)
        .all(activeId);
      const services = db.prepare('SELECT * FROM services WHERE store_id = ? AND active = 1 ORDER BY id ASC').all(activeId);
      const products = db.prepare('SELECT * FROM products WHERE store_id = ? AND active = 1 ORDER BY category ASC, id ASC').all(activeId);
      const packages = db
        .prepare(`
          SELECT pk.*, t.name as tutor_name, p.name as pet_name
          FROM packages pk
          JOIN tutors t ON t.id = pk.tutor_id
          JOIN pets p ON p.id = pk.pet_id
          WHERE pk.store_id = ?
        `)
        .all(activeId);

      res.json({
        mode,
        stores,
        activeStore,
        staff,
        tutors,
        pets,
        services,
        products,
        packages,
      });
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- CONSOLIDATED MULTI-UNIT SUMMARY ---
  app.get('/api/consolidated', (req, res) => {
    const { mode, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const summary = db
        .prepare(`
          SELECT
            s.id as store_id,
            s.name,
            s.city,
            s.currency,
            (SELECT COUNT(*) FROM pets p WHERE p.store_id = s.id) as pets_count,
            (SELECT COUNT(*) FROM appointments a WHERE a.store_id = s.id AND a.status != 'cancelled') as appointments_count,
            (SELECT COALESCE(SUM(c.total), 0) FROM comandas c WHERE c.store_id = s.id AND c.status = 'paid') as paid_revenue
          FROM stores s
          ORDER BY s.id ASC
        `)
        .all();
      res.json(summary);
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- STORE SETTINGS ---
  app.patch('/api/stores/:id', (req, res) => {
    const { mode, actor } = getContext(req);
    try {
      if (actor.userRole !== 'manager') {
        throw new DomainError(403, msg(actor.lang, 'Solo el gestor puede editar la tienda.', 'Apenas o gestor pode editar a loja.'));
      }
      const db = getDb(mode);
      const storeId = Number(req.params.id);
      const b = req.body;
      db.prepare(`
        UPDATE stores
        SET name = COALESCE(?, name),
            city = COALESCE(?, city),
            currency = COALESCE(?, currency),
            default_lang = COALESCE(?, default_lang),
            accent_color = COALESCE(?, accent_color),
            logo_url = COALESCE(?, logo_url),
            whatsapp = COALESCE(?, whatsapp),
            address = COALESCE(?, address),
            tax_id = COALESCE(?, tax_id),
            fiscal_mode = COALESCE(?, fiscal_mode),
            hours_clinic = COALESCE(?, hours_clinic),
            hours_grooming = COALESCE(?, hours_grooming)
        WHERE id = ?
      `).run(
        b.name ?? null,
        b.city ?? null,
        b.currency ?? null,
        b.default_lang ?? null,
        b.accent_color ?? null,
        b.logo_url === undefined ? null : b.logo_url,
        b.whatsapp ?? null,
        b.address ?? null,
        b.tax_id ?? null,
        b.fiscal_mode ?? null,
        b.hours_clinic ?? null,
        b.hours_grooming ?? null,
        storeId,
      );
      writeAuditLog(db, storeId, actor, 'UPDATE_STORE', 'store', storeId, { name: b.name, currency: b.currency });
      res.json(db.prepare('SELECT * FROM stores WHERE id = ?').get(storeId));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- TUTORS & PETS ---
  app.post('/api/tutors', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createTutor(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.get('/api/tutors/:id/lgpd-export', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(exportTutorLgpdData(db, storeId, Number(req.params.id), actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/tutors/:id/lgpd-anonymize', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(anonymizeTutorLgpd(db, storeId, Number(req.params.id), actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/pets', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createPet(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.delete('/api/pets/:id', (req, res) => {
    const { actor } = getContext(req);
    try {
      deletePetForbidden(actor);
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- FULL PET CLINICAL RECORD (TIMELINE + SOAP + ADDENDA + RX + DOCS + VACCINES + WEIGHTS) ---
  app.get('/api/pets/:id/record', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const petId = Number(req.params.id);
      const pet = db
        .prepare(`
          SELECT p.*, t.name as tutor_name, t.phone as tutor_phone, t.document as tutor_document, t.address as tutor_address
          FROM pets p
          JOIN tutors t ON t.id = p.tutor_id
          WHERE p.id = ? AND p.store_id = ?
        `)
        .get(petId, storeId);
      if (!pet) {
        throw new DomainError(404, msg(actor.lang, 'Paciente no encontrado.', 'Paciente não encontrado.'));
      }

      const weights = db.prepare('SELECT * FROM pet_weights WHERE pet_id = ? ORDER BY recorded_at ASC').all(petId);
      const consultsRaw = db
        .prepare('SELECT * FROM consultations WHERE pet_id = ? ORDER BY visit_date DESC')
        .all(petId) as any[];

      const consultations = consultsRaw.map((c) => {
        const addenda = db
          .prepare('SELECT * FROM consultation_addenda WHERE consultation_id = ? ORDER BY created_at ASC')
          .all(c.id);
        const rxRaw = db
          .prepare('SELECT * FROM prescriptions WHERE consultation_id = ? ORDER BY created_at DESC')
          .all(c.id) as any[];
        const prescriptions = rxRaw.map((rx) => ({
          ...rx,
          items: db.prepare('SELECT * FROM prescription_items WHERE prescription_id = ?').all(rx.id),
        }));
        return { ...c, addenda, prescriptions };
      });

      const documents = db
        .prepare('SELECT * FROM clinical_documents WHERE pet_id = ? ORDER BY created_at DESC')
        .all(petId);
      const vaccines = db
        .prepare('SELECT * FROM vaccines WHERE pet_id = ? ORDER BY applied_date DESC')
        .all(petId);
      const grooming = db
        .prepare(`
          SELECT g.*, s.name_es as service_name_es, s.name_pt as service_name_pt
          FROM grooming_orders g
          JOIN services s ON s.id = g.service_id
          WHERE g.pet_id = ?
          ORDER BY g.created_at DESC
        `)
        .all(petId);
      const comandas = db
        .prepare('SELECT * FROM comandas WHERE pet_id = ? ORDER BY created_at DESC')
        .all(petId);

      res.json({
        pet,
        weights,
        consultations,
        documents,
        vaccines,
        grooming,
        comandas,
      });
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/consultations', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createConsultation(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.put('/api/consultations/:id', (req, res) => {
    const { actor } = getContext(req);
    try {
      updateConsultationForbidden(actor);
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/consultations/:id/addenda', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(addConsultationAddendum(db, storeId, Number(req.params.id), actor, req.body.note));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/prescriptions', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createPrescription(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/documents', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createClinicalDocument(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.patch('/api/documents/:id/release', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(toggleDocumentRelease(db, storeId, Number(req.params.id), Boolean(req.body.released), actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- GEMINI AI OPTIONAL SOAP DRAFT (SERVER-SIDE ONLY) ---
  app.post('/api/ai/soap-draft', async (req, res) => {
    const { actor } = getContext(req);
    try {
      const { transcript, petName, species, weightKg, allergies } = req.body as {
        transcript: string;
        petName?: string;
        species?: string;
        weightKg?: number;
        allergies?: string | null;
      };
      if (!transcript?.trim()) {
        return res.status(400).json({
          error: msg(
            actor.lang,
            'Ingrese o dicte las notas clínicas para generar el borrador.',
            'Digite ou dite as notas clínicas para gerar o rascunho.',
          ),
        });
      }
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        return res.status(503).json({
          error: msg(
            actor.lang,
            'Clave GEMINI_API_KEY no configurada en el servidor.',
            'Chave GEMINI_API_KEY não configurada no servidor.',
          ),
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const targetLang = actor.lang === 'pt-BR' ? 'Português do Brasil' : 'Español veterinario';
      const prompt = `Eres un asistente de transcripción clínica veterinaria.
Convierte las notas dictadas en un BORRADOR SOAP estructurado en ${targetLang} para revisión obligatoria del médico veterinario.
Paciente: ${petName || 'Paciente'} (${species || 'animal'}, ${weightKg || '?'} kg).
Alergias registradas: ${allergies || 'Ninguna conocida'}.
Notas de la consulta:
"""
${transcript}
"""
Si hay información faltante para signos vitales, deja null o menciona que falta medir. Nunca inventes diagnósticos definitivos sin sustento en las notas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              subjective: { type: Type.STRING },
              objective_exam: { type: Type.STRING },
              assessment_dx: { type: Type.STRING },
              plan_conduct: { type: Type.STRING },
            },
            required: ['subjective', 'objective_exam', 'assessment_dx', 'plan_conduct'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ draft: parsed, disclaimer: 'AI_DRAFT_REQUIRES_VET_REVIEW' });
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- VACCINES ---
  app.get('/api/vaccines', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const rows = db
        .prepare(`
          SELECT v.*, p.name as pet_name, p.species as pet_species, t.name as tutor_name, t.phone as tutor_phone
          FROM vaccines v
          JOIN pets p ON p.id = v.pet_id
          JOIN tutors t ON t.id = p.tutor_id
          WHERE v.store_id = ?
          ORDER BY v.next_due_date ASC
        `)
        .all(storeId);
      res.json(rows);
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/vaccines', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(applyVaccine(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/vaccines/:id/remind', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(markVaccineReminded(db, storeId, Number(req.params.id), req.body.note, actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- AGENDA / APPOINTMENTS ---
  app.get('/api/appointments', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const rows = db
        .prepare(`
          SELECT a.*, p.name as pet_name, p.species as pet_species,
                 t.name as tutor_name, t.phone as tutor_phone,
                 u.name as professional_name,
                 s.name_es as service_name_es, s.name_pt as service_name_pt
          FROM appointments a
          JOIN pets p ON p.id = a.pet_id
          JOIN tutors t ON t.id = a.tutor_id
          JOIN users u ON u.id = a.professional_id
          LEFT JOIN services s ON s.id = a.service_id
          WHERE a.store_id = ?
          ORDER BY a.start_time ASC
        `)
        .all(storeId);
      res.json(rows);
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/appointments', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createAppointment(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.patch('/api/appointments/:id/status', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(updateAppointmentStatus(db, storeId, Number(req.params.id), req.body.status, actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- GROOMING KANBAN ---
  app.get('/api/grooming', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const rows = db
        .prepare(`
          SELECT g.*, p.name as pet_name, p.breed as pet_breed, p.photo_url as pet_photo,
                 t.name as tutor_name, t.phone as tutor_phone,
                 s.name_es as service_name_es, s.name_pt as service_name_pt, s.price as service_price
          FROM grooming_orders g
          JOIN pets p ON p.id = g.pet_id
          JOIN tutors t ON t.id = g.tutor_id
          JOIN services s ON s.id = g.service_id
          WHERE g.store_id = ?
          ORDER BY g.id DESC
        `)
        .all(storeId);
      res.json(rows);
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/grooming', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createGroomingOrder(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.patch('/api/grooming/:id/status', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(updateGroomingStatus(db, storeId, Number(req.params.id), req.body.status, actor, req.body.photo_ready_url));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/grooming/:id/to-comanda', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(sendGroomingToComanda(db, storeId, Number(req.params.id), actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- HOSPITALIZATION & SURGERY ---
  app.get('/api/hospitalizations', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const rows = db
        .prepare(`
          SELECT h.*, p.name as pet_name, p.species as pet_species, p.weight_kg as pet_weight, p.allergies as pet_allergies,
                 t.name as tutor_name, t.phone as tutor_phone
          FROM hospitalizations h
          JOIN pets p ON p.id = h.pet_id
          JOIN tutors t ON t.id = p.tutor_id
          WHERE h.store_id = ?
          ORDER BY h.status ASC, h.admitted_at DESC
        `)
        .all(storeId) as any[];
      const enriched = rows.map((h) => ({
        ...h,
        tasks: db.prepare('SELECT * FROM hospitalization_tasks WHERE hospitalization_id = ? ORDER BY scheduled_time ASC').all(h.id),
        notes: db.prepare('SELECT * FROM hospitalization_notes WHERE hospitalization_id = ? ORDER BY created_at DESC').all(h.id),
      }));
      const surgeries = db
        .prepare(`
          SELECT su.*, p.name as pet_name, t.name as tutor_name
          FROM surgeries su
          JOIN pets p ON p.id = su.pet_id
          JOIN tutors t ON t.id = p.tutor_id
          WHERE su.store_id = ?
          ORDER BY su.scheduled_at ASC
        `)
        .all(storeId);
      res.json({ hospitalizations: enriched, surgeries });
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/hospitalizations', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(addHospitalization(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/hospitalization-tasks/:id/execute', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(executeHospitalTask(db, storeId, Number(req.params.id), actor));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/hospitalizations/:id/notes', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const hospId = Number(req.params.id);
      const now = new Date().toISOString();
      const resNote = db
        .prepare('INSERT INTO hospitalization_notes (hospitalization_id, author_name, shift, note, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(hospId, actor.userName, req.body.shift || 'day', req.body.note, now);
      writeAuditLog(db, storeId, actor, 'ADD_HOSP_NOTE', 'hospitalization', hospId, { note: req.body.note });
      res.status(201).json(db.prepare('SELECT * FROM hospitalization_notes WHERE id = ?').get(Number(resNote.lastInsertRowid)));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.patch('/api/hospitalizations/:id/outcome', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const hospId = Number(req.params.id);
      const status = req.body.status === 'deceased' ? 'deceased' : 'discharged';
      const now = new Date().toISOString();
      db.prepare('UPDATE hospitalizations SET status = ?, discharged_at = ?, outcome_summary = ? WHERE id = ? AND store_id = ?').run(
        status,
        now,
        req.body.outcome_summary || '',
        hospId,
        storeId,
      );
      writeAuditLog(db, storeId, actor, 'HOSP_OUTCOME', 'hospitalization', hospId, { status });
      res.json(db.prepare('SELECT * FROM hospitalizations WHERE id = ?').get(hospId));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/surgeries', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const b = req.body;
      const result = db
        .prepare(`
          INSERT INTO surgeries (store_id, pet_id, surgeon_name, surgery_name, scheduled_at, fasting_hours, anesthetic_protocol, checklist_json, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        `)
        .run(
          storeId,
          b.pet_id,
          b.surgeon_name || actor.userName,
          b.surgery_name,
          b.scheduled_at,
          Number(b.fasting_hours || 8),
          b.anesthetic_protocol || 'Protocolo estándar',
          JSON.stringify(b.checklist || { preExamsOk: false, consentSigned: false, fastingConfirmed: false, ivAccess: false }),
        );
      res.status(201).json(db.prepare('SELECT * FROM surgeries WHERE id = ?').get(Number(result.lastInsertRowid)));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- COMANDAS & PDV ---
  app.get('/api/comandas', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const rows = db.prepare('SELECT id FROM comandas WHERE store_id = ? ORDER BY id DESC').all(storeId) as { id: number }[];
      res.json(rows.map((r) => getComandaWithItems(db, r.id)));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/comandas', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(createComanda(db, storeId, actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/comandas/:id/items', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.status(201).json(addComandaItem(db, storeId, Number(req.params.id), actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/comandas/:id/checkout', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      res.json(checkoutComanda(db, storeId, Number(req.params.id), actor, req.body));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- PRODUCTS & SERVICES ---
  app.post('/api/products', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      if (!['manager', 'reception'].includes(actor.userRole)) {
        throw new DomainError(403, msg(actor.lang, 'Sin permiso para editar inventario.', 'Sem permissão para editar estoque.'));
      }
      const db = getDb(mode);
      const b = req.body;
      const result = db
        .prepare(`
          INSERT INTO products (store_id, sku, barcode, name_es, name_pt, category, unit, price, cost, stock_qty, min_stock, batch_code, expiry_date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          storeId,
          b.sku || `SKU-${Date.now()}`,
          b.barcode || String(Date.now()),
          b.name_es,
          b.name_pt || b.name_es,
          b.category,
          b.unit || 'unidad',
          Number(b.price),
          Number(b.cost || 0),
          Number(b.stock_qty || 0),
          Number(b.min_stock || 2),
          b.batch_code || null,
          b.expiry_date || null,
        );
      res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(Number(result.lastInsertRowid)));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- FINANCE & AUDIT LOGS ---
  app.get('/api/finance', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const entries = db
        .prepare(`
          SELECT f.*, u.name as professional_name
          FROM financial_entries f
          LEFT JOIN users u ON u.id = f.professional_id
          WHERE f.store_id = ?
          ORDER BY f.due_date DESC, f.id DESC
        `)
        .all(storeId);
      const auditLogs = db
        .prepare('SELECT * FROM audit_logs WHERE store_id = ? ORDER BY id DESC LIMIT 100')
        .all(storeId);
      res.json({ entries, auditLogs });
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  app.post('/api/finance', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      if (actor.userRole !== 'manager' && actor.userRole !== 'reception') {
        throw new DomainError(403, msg(actor.lang, 'Permiso denegado.', 'Permissão negada.'));
      }
      const db = getDb(mode);
      const b = req.body;
      const result = db
        .prepare(`
          INSERT INTO financial_entries (store_id, type, category, description, amount, due_date, paid_date, status, professional_id, commission_pct)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          storeId,
          b.type,
          b.category || 'General',
          b.description,
          Number(b.amount),
          b.due_date,
          b.status === 'paid' ? b.due_date : null,
          b.status || 'paid',
          b.professional_id ?? null,
          Number(b.commission_pct || 0),
        );
      res.status(201).json(db.prepare('SELECT * FROM financial_entries WHERE id = ?').get(Number(result.lastInsertRowid)));
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- TUTOR PORTAL LOOKUP ---
  app.get('/api/portal/lookup', (req, res) => {
    const { mode, storeId, actor } = getContext(req);
    try {
      const db = getDb(mode);
      const phoneRaw = String(req.query.phone || '').replace(/[^\d]/g, '');
      const tutors = db.prepare('SELECT * FROM tutors WHERE store_id = ?').all(storeId) as any[];
      const tutor = phoneRaw
        ? tutors.find((t) => String(t.phone).replace(/[^\d]/g, '').includes(phoneRaw))
        : tutors[0];
      if (!tutor) {
        return res.status(404).json({
          error: msg(actor.lang, 'Teléfono de tutor no encontrado.', 'Telefone do tutor não encontrado.'),
        });
      }
      const pets = db.prepare('SELECT * FROM pets WHERE tutor_id = ?').all(tutor.id) as any[];
      const petIds = pets.map((p) => p.id);
      const vaccines = petIds.length
        ? db.prepare(`SELECT * FROM vaccines WHERE pet_id IN (${petIds.map(() => '?').join(',')}) ORDER BY next_due_date ASC`).all(...petIds)
        : [];
      const documents = petIds.length
        ? db
            .prepare(`SELECT * FROM clinical_documents WHERE pet_id IN (${petIds.map(() => '?').join(',')}) AND released_to_tutor = 1 ORDER BY created_at DESC`)
            .all(...petIds)
        : [];
      const comandas = db.prepare('SELECT * FROM comandas WHERE tutor_id = ? ORDER BY created_at DESC').all(tutor.id);
      const grooming = db
        .prepare(`
          SELECT g.*, p.name as pet_name, s.name_es as service_name_es, s.name_pt as service_name_pt
          FROM grooming_orders g
          JOIN pets p ON p.id = g.pet_id
          JOIN services s ON s.id = g.service_id
          WHERE g.tutor_id = ?
          ORDER BY g.created_at DESC
        `)
        .all(tutor.id);
      res.json({ tutor, pets, vaccines, documents, comandas, grooming });
    } catch (err) {
      handleError(res, err, actor.lang);
    }
  });

  // --- VITE / STATIC SERVING ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VORTELOPET server running at http://localhost:${PORT}`);
  });
}

startServer();
