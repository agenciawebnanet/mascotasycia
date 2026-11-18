import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../src/server/db.ts';
import { runMigrations } from '../src/server/migrations.ts';
import { seedDemoDatabase } from '../src/server/seedDemo.ts';
import {
  addComandaItem,
  addConsultationAddendum,
  applyVaccine,
  checkoutComanda,
  createComanda,
  createConsultation,
  createPet,
  createPrescription,
  createTutor,
  deletePetForbidden,
  DomainError,
  sendGroomingToComanda,
  updateConsultationForbidden,
  updateGroomingStatus,
  type ActorContext,
} from '../src/server/services/clinicService.ts';
import { formatCurrency } from '../src/shared/currency.ts';

const vetActor: ActorContext = {
  userId: 1,
  userName: 'Dra. Fabiele Silva (Test)',
  userRole: 'vet',
  lang: 'es',
};

const managerActor: ActorContext = {
  userId: 5,
  userName: 'Gestor (Test)',
  userRole: 'manager',
  lang: 'es',
};

const receptionActor: ActorContext = {
  userId: 2,
  userName: 'Recepción (Test)',
  userRole: 'reception',
  lang: 'es',
};

test('Versioned migrations run idempotently and seed Mascotas y Cia demo data', () => {
  const db = createMemoryDb();
  // Calling runMigrations again must be idempotent
  runMigrations(db);
  seedDemoDatabase(db);

  const store = db.prepare('SELECT * FROM stores WHERE code = ?').get('MC-CDE-01') as any;
  assert.equal(store.name, 'Mascotas y Cia');
  assert.equal(store.currency, 'PYG');
  assert.equal(store.default_lang, 'es');

  const pets = db.prepare('SELECT * FROM pets WHERE store_id = ?').all(store.id) as any[];
  assert.equal(pets.length, 4);
  const products = db.prepare('SELECT * FROM products WHERE store_id = ?').all(store.id) as any[];
  assert.equal(products.length, 18);
});

test('Currency formatting handles PYG (G$), BRL (R$) and ARS correctly', () => {
  assert.equal(formatCurrency(120000, 'PYG'), 'G$ 120.000');
  assert.equal(formatCurrency(150.5, 'BRL').replace(/\u00a0/g, ' '), 'R$ 150,50');
  assert.match(formatCurrency(1500, 'ARS'), /1\.500/);
});

test('Prontuário is immutable, prevents pet deletion, enforces allergy check, and logs addenda', () => {
  const db = createMemoryDb();
  seedDemoDatabase(db);

  const rex = db.prepare("SELECT * FROM pets WHERE name = 'Rex'").get() as any;
  assert.ok(rex);

  // Pet deletion must be blocked
  assert.throws(() => deletePetForbidden(managerActor), DomainError);

  // Direct consultation edit must be blocked
  assert.throws(() => updateConsultationForbidden(vetActor), DomainError);

  // Create SOAP consultation
  const consult = createConsultation(db, rex.store_id, vetActor, {
    pet_id: rex.id,
    subjective: 'Control de evolución 48h, apetito recuperado.',
    objective_exam: 'Normotérmico, mucosas rosadas.',
    temp_c: 38.4,
    weight_kg: 28.7,
    assessment_dx: 'Recuperación completa',
    plan_conduct: 'Alta clínica.',
  }) as any;
  assert.equal(consult.is_locked, 1);

  // Weight should auto-update on Rex
  const updatedRex = db.prepare('SELECT weight_kg FROM pets WHERE id = ?').get(rex.id) as any;
  assert.equal(updatedRex.weight_kg, 28.7);

  // Allergy safety check: prescribing Dipirona to Rex must throw
  assert.throws(
    () =>
      createPrescription(db, rex.store_id, vetActor, {
        consultation_id: consult.id,
        pet_id: rex.id,
        type: 'normal',
        valid_until: '2026-12-31',
        items: [
          {
            medication_name: 'Dipirona Sódica 500mg',
            dose_mg_kg: 25,
            calculated_dose: '717 mg',
            route: 'Oral',
            frequency: '8/8h',
            duration_days: 3,
            quantity_text: '1 caja',
          },
        ],
      }),
    DomainError,
  );

  // Addendum works and writes audit log
  const addendum = addConsultationAddendum(db, rex.store_id, consult.id, vetActor, 'Tutor confirmó tolerancia oral.') as any;
  assert.equal(addendum.consultation_id, consult.id);
  const audit = db.prepare("SELECT * FROM audit_logs WHERE action = 'ADD_ADDENDUM' AND entity_id = ?").get(String(consult.id));
  assert.ok(audit);
});

test('Vaccines track overdue (Thor) and upcoming 30-day booster (Luna) and allow new application', () => {
  const db = createMemoryDb();
  seedDemoDatabase(db);

  const todayStr = new Date().toISOString().slice(0, 10);
  const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const overdue = db
    .prepare("SELECT v.*, p.name as pet_name FROM vaccines v JOIN pets p ON p.id = v.pet_id WHERE v.next_due_date < ?")
    .all(todayStr) as any[];
  assert.ok(overdue.some((v) => v.pet_name === 'Thor'));

  const dueSoon = db
    .prepare("SELECT v.*, p.name as pet_name FROM vaccines v JOIN pets p ON p.id = v.pet_id WHERE v.next_due_date >= ? AND v.next_due_date <= ?")
    .all(todayStr, in30DaysStr) as any[];
  assert.ok(dueSoon.some((v) => v.pet_name === 'Luna'));

  const thor = db.prepare("SELECT * FROM pets WHERE name = 'Thor'").get() as any;
  const applied = applyVaccine(db, thor.store_id, vetActor, {
    pet_id: thor.id,
    protocol_code: 'CAN-RAB',
    vaccine_name: 'Antirrábica Canina',
    dose_number: 'Refuerzo Actualizado',
    applied_date: todayStr,
    next_due_date: '2027-11-18',
    batch_code: 'RAB-2026-Z',
    manufacturer: 'Zoetis',
  }) as any;
  assert.equal(applied.batch_code, 'RAB-2026-Z');
});

test('Grooming Kanban deducts package on delivery and PDV checkout decrements product stock and enforces fiado limit', () => {
  const db = createMemoryDb();
  seedDemoDatabase(db);

  const ninaOrder = db
    .prepare("SELECT g.* FROM grooming_orders g JOIN pets p ON p.id = g.pet_id WHERE p.name = 'Nina'")
    .get() as any;
  const pkgBefore = db.prepare('SELECT used_sessions FROM packages WHERE id = ?').get(ninaOrder.package_id) as any;
  assert.equal(pkgBefore.used_sessions, 2);

  updateGroomingStatus(db, ninaOrder.store_id, ninaOrder.id, 'delivered', managerActor);
  const pkgAfter = db.prepare('SELECT used_sessions FROM packages WHERE id = ?').get(ninaOrder.package_id) as any;
  assert.equal(pkgAfter.used_sessions, 3);

  const comandaFromGroom = sendGroomingToComanda(db, ninaOrder.store_id, ninaOrder.id, managerActor) as any;
  assert.ok(comandaFromGroom.id);

  // Test Comanda + PDV checkout with automatic stock decrement
  const product = db.prepare("SELECT * FROM products WHERE sku = 'ALM-001'").get() as any;
  const initialStock = product.stock_qty;
  const tutor = db.prepare('SELECT * FROM tutors WHERE store_id = ? LIMIT 1').get(ninaOrder.store_id) as any;

  const comanda = createComanda(db, ninaOrder.store_id, managerActor, { tutor_id: tutor.id }) as any;
  addComandaItem(db, ninaOrder.store_id, comanda.id, managerActor, {
    item_type: 'product',
    ref_id: product.id,
    qty: 2,
  });

  // Fiado above credit limit should throw
  const excessiveComanda = createComanda(db, ninaOrder.store_id, managerActor, { tutor_id: tutor.id }) as any;
  addComandaItem(db, ninaOrder.store_id, excessiveComanda.id, managerActor, {
    item_type: 'product',
    ref_id: product.id,
    qty: 5, // 5 * 285000 = 1,425,000 > 800,000 credit limit
  });
  assert.throws(
    () => checkoutComanda(db, ninaOrder.store_id, excessiveComanda.id, managerActor, { payment_method: 'fiado' }),
    DomainError,
  );

  // PIX checkout succeeds and lowers stock by 2
  const paid = checkoutComanda(db, ninaOrder.store_id, comanda.id, managerActor, { payment_method: 'pix' }) as any;
  assert.equal(paid.status, 'paid');
  assert.equal(paid.total, product.price * 2);

  const productAfter = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(product.id) as any;
  assert.equal(productAfter.stock_qty, initialStock - 2);
});

test('Registration rules: phone duplication, unique microchip, future birth, weight and discount permission', () => {
  const db = createMemoryDb();
  seedDemoDatabase(db);
  const store = db.prepare("SELECT * FROM stores WHERE code = 'MC-CDE-01'").get() as any;
  assert.ok(store);

  const tutor = createTutor(db, store.id, receptionActor, {
    name: 'Tutor Nuevo',
    document: '1234567',
    phone: '+595 985 111 222',
  }) as any;
  assert.ok(tutor.id);

  // Mesmo telefone normalizado (com/sem máscara) não pode duplicar
  assert.throws(
    () => createTutor(db, store.id, receptionActor, { name: 'Duplicado', document: '999', phone: '595985111222' }),
    DomainError,
  );

  const pet = createPet(db, store.id, receptionActor, {
    tutor_id: tutor.id,
    name: 'Firulais',
    species: 'dog',
    breed: 'Mestizo',
    sex: 'M',
    birth_date: '2023-01-01',
    weight_kg: 8.5,
    microchip: 'CHIP-TEST-1',
  }) as any;
  assert.ok(pet.id);

  // Microchip é único globalmente
  assert.throws(
    () => createPet(db, store.id, receptionActor, {
      tutor_id: tutor.id, name: 'Otro', species: 'dog', breed: 'Mestizo', sex: 'M',
      birth_date: '2023-01-01', weight_kg: 5, microchip: 'CHIP-TEST-1',
    }),
    DomainError,
  );

  // Nascimento futuro e peso zero são rejeitados
  assert.throws(
    () => createPet(db, store.id, receptionActor, {
      tutor_id: tutor.id, name: 'Futuro', species: 'dog', breed: 'Mestizo', sex: 'M',
      birth_date: '2099-01-01', weight_kg: 5,
    }),
    DomainError,
  );
  assert.throws(
    () => createPet(db, store.id, receptionActor, {
      tutor_id: tutor.id, name: 'Peso', species: 'dog', breed: 'Mestizo', sex: 'M',
      birth_date: '2023-01-01', weight_kg: 0,
    }),
    DomainError,
  );

  // Desconto acima de 10% exige gestor
  const comanda = createComanda(db, store.id, receptionActor, { tutor_id: tutor.id, pet_id: pet.id }) as any;
  const product = db.prepare('SELECT * FROM products WHERE store_id = ? LIMIT 1').get(store.id) as any;
  addComandaItem(db, store.id, comanda.id, receptionActor, {
    item_type: 'product', ref_id: product.id, qty: 1,
  });
  const fresh = db.prepare('SELECT subtotal FROM comandas WHERE id = ?').get(comanda.id) as any;
  const half = Math.round(Number(fresh.subtotal) * 0.5);
  assert.throws(
    () => checkoutComanda(db, store.id, comanda.id, receptionActor, { payment_method: 'cash', discount: half }),
    DomainError,
  );
  const paid = checkoutComanda(db, store.id, comanda.id, managerActor, { payment_method: 'cash', discount: half }) as any;
  assert.equal(paid.status, 'paid');
  assert.equal(paid.total, Number(fresh.subtotal) - half);
});
