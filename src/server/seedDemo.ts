import type { DatabaseSync } from 'node:sqlite';

function offsetDate(daysOffset: number, timeStr = '09:00:00'): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${timeStr}`;
}

function offsetDateOnly(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function seedProductionBaseline(db: DatabaseSync): void {
  db.exec('BEGIN;');
  try {
    db.prepare(`
      INSERT INTO stores (
        code, name, city, country, currency, default_lang, timezone, accent_color,
        logo_url, whatsapp, phone, address, tax_id_label, tax_id, fiscal_mode,
        hours_clinic, hours_grooming, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(
      'CLINICA-PRINCIPAL',
      'Mi Clínica Veterinaria',
      'Ciudad del Este',
      'PY',
      'PYG',
      'es',
      'America/Asuncion',
      '#0f766e',
      null,
      '+595981000000',
      '+595 61 000 000',
      'Dirección a configurar',
      'RUC',
      '80000000-0',
      'PY_DOC_READY',
      'Lun-Sáb 08:00-19:00 + Guardia 24h',
      'Lun-Sáb 08:00-17:00',
    );

    const storeId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    db.prepare(`
      INSERT INTO users (store_id, name, role, crmv_or_reg, specialty, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(storeId, 'Administrador / Gestor', 'manager', null, 'Gestión Clínica', '+595981000000');

    db.prepare(`
      INSERT INTO users (store_id, name, role, crmv_or_reg, specialty, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(storeId, 'Veterinario Responsable', 'vet', 'REG-VET-0001', 'Clínica General', '+595981000001');

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function seedDemoDatabase(db: DatabaseSync): void {
  db.exec('BEGIN;');
  try {
    // 1. Stores (Mascotas & Cia main unit + 2nd unit for multi-unit demo)
    const insertStore = db.prepare(`
      INSERT INTO stores (
        code, name, city, country, currency, default_lang, timezone, accent_color,
        logo_url, whatsapp, phone, address, tax_id_label, tax_id, fiscal_mode,
        hours_clinic, hours_grooming, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertStore.run(
      'MC-CDE-01',
      'Mascotas & Cia',
      'Ciudad del Este, Paraguay',
      'PY',
      'PYG',
      'es',
      'America/Asuncion',
      '#0f766e',
      null,
      '+595981000123',
      '+595 61 500 123 (Ejemplo)',
      'Av. Monseñor Rodríguez Km 4 (Datos de ejemplo), Ciudad del Este',
      'RUC',
      '80099112-4 (Ejemplo)',
      'PY_DOC_READY',
      'Lun-Sáb 08:00-19:00 + Guardia 24h',
      'Lun-Sáb 08:00-17:00',
    );
    const mainStoreId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertStore.run(
      'MC-FOZ-02',
      'Mascotas & Cia — Filial Vila A (BR)',
      'Foz do Iguaçu, PR, Brasil',
      'BR',
      'BRL',
      'pt-BR',
      'America/Sao_Paulo',
      '#0f766e',
      null,
      '+5545999000123',
      '+55 45 3520-0123 (Exemplo)',
      'Av. Silvio Américo Sasdelli, 1200 (Dados de exemplo), Foz do Iguaçu',
      'CNPJ',
      '45.123.456/0001-00 (Exemplo)',
      'BR_NFCE_NFSE',
      'Seg-Sáb 08:00-19:00',
      'Seg-Sáb 08:00-17:00',
    );
    const brStoreId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // 2. Staff Users
    const insertUser = db.prepare(`
      INSERT INTO users (store_id, name, role, crmv_or_reg, specialty, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run(mainStoreId, 'Dra. Fabiele Silva (Ejemplo)', 'vet', 'SENACSA-VET 0482-PY (Ficticio)', 'Clínica Médica y Cirugía', '+595981000101');
    const vet1Id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertUser.run(mainStoreId, 'Dr. Rodrigo Méndez (Ejemplo)', 'vet', 'SENACSA-VET 0619-PY (Ficticio)', 'Medicina Felina y Vacunación', '+595981000102');
    const vet2Id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertUser.run(mainStoreId, 'Sofía Cáceres (Ejemplo)', 'reception', null, 'Recepción y Caja', '+595981000103');
    insertUser.run(mainStoreId, 'Diego Acosta (Ejemplo)', 'groomer', null, 'Baño, Tosa y Estética', '+595981000104');
    const groomerId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertUser.run(mainStoreId, 'Gestión Mascotas & Cia', 'manager', null, 'Dirección General', '+595981000100');

    // Staff for branch 2
    insertUser.run(brStoreId, 'Dra. Fabiele Silva (Filial BR)', 'vet', 'CRMV-PR 19482 (Fictício)', 'Clínica Geral', '+5545999000101');

    // 3. Fictitious Tutors (3 tutors)
    const insertTutor = db.prepare(`
      INSERT INTO tutors (store_id, name, document, phone, email, address, notes, lgpd_consent, lgpd_consent_at, credit_limit, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
    `);
    const nowIso = new Date().toISOString();

    insertTutor.run(
      mainStoreId,
      'Mateo Benítez (Ejemplo)',
      'CI 4.512.890-1',
      '+595983410220',
      'mateo.ejemplo@mascotasycia.demo',
      'Av. San Blas Km 3,5 (Datos de ejemplo), Ciudad del Este',
      'Tutor frecuente de clínica y tienda. Prefiere contacto por WhatsApp.',
      nowIso,
      800000,
      offsetDate(-120),
    );
    const tutor1Id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertTutor.run(
      mainStoreId,
      'Camila Duarte (Ejemplo)',
      'CI 3.984.112-4',
      '+595973558190',
      'camila.ejemplo@mascotasycia.demo',
      'Barrio Boquerón Calle 4 (Datos de ejemplo), Ciudad del Este',
      'Tiene pendiente refuerzo antirrábico de Thor.',
      nowIso,
      500000,
      offsetDate(-90),
    );
    const tutor2Id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertTutor.run(
      mainStoreId,
      'Lucas Ferreira (Ejemplo)',
      'CI 5.102.774-8',
      '+595991304880',
      'lucas.ejemplo@mascotasycia.demo',
      'Área 1 Manzana 12 (Datos de ejemplo), Ciudad del Este',
      'Paquete activo de baño mensual para Nina.',
      nowIso,
      400000,
      offsetDate(-60),
    );
    const tutor3Id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // Branch 2 sample tutor
    insertTutor.run(
      brStoreId,
      'Mariana Costa (Exemplo)',
      'CPF 091.222.333-44',
      '+5545998123456',
      'mariana.exemplo@mascotasycia.demo',
      'Vila A, Foz do Iguaçu (Dados de exemplo)',
      'Atendimento filial Brasil.',
      nowIso,
      500,
      offsetDate(-30),
    );
    const brTutorId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // 4. 4 Pets: Rex, Luna, Thor, Nina
    const insertPet = db.prepare(`
      INSERT INTO pets (
        store_id, tutor_id, name, species, breed, sex, birth_date, weight_kg,
        microchip, photo_url, neutered, allergies, chronic_conditions, temperament, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPet.run(
      mainStoreId,
      tutor1Id,
      'Rex',
      'dog',
      'Mestizo Pastor Alemán',
      'M',
      '2022-04-12',
      28.5,
      'PY-900118002',
      '/src/assets/images/pet_rex_dog_1795016852538.jpg',
      1,
      'Dipirona (Metamizol) — NO ADMINISTRAR',
      'Sensibilidad gastrointestinal estacional',
      'Dócil y colaborador en camilla',
      offsetDate(-120),
    );
    const rexId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertPet.run(
      mainStoreId,
      tutor1Id,
      'Luna',
      'cat',
      'Común Europeo Tabby',
      'F',
      '2024-06-18',
      4.2,
      'PY-900118009',
      '/src/assets/images/pet_luna_cat_1795016850234.jpg',
      1,
      null,
      'Ninguna registrada',
      'Tímida al inicio, tranquila con manejo suave',
      offsetDate(-85),
    );
    const lunaId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertPet.run(
      mainStoreId,
      tutor2Id,
      'Thor',
      'dog',
      'Mestizo Caramelo',
      'M',
      '2023-08-05',
      12.0,
      'PY-900118014',
      '/src/assets/images/pet_thor_dog_1795016850647.jpg',
      0,
      null,
      'Otitis externa recurrente (controlada)',
      'Activo y curioso',
      offsetDate(-75),
    );
    const thorId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertPet.run(
      mainStoreId,
      tutor3Id,
      'Nina',
      'dog',
      'Poodle Toy Mix',
      'F',
      '2021-10-20',
      7.0,
      'PY-900118021',
      '/src/assets/images/pet_nina_dog_1795016853802.jpg',
      1,
      'Perfumes con alcohol en baño (usar línea hipoalergénica)',
      'Ninguna',
      'Muy amigable, habituada al baño',
      offsetDate(-60),
    );
    const ninaId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // Branch 2 pet
    insertPet.run(
      brStoreId,
      brTutorId,
      'Bento',
      'dog',
      'Golden Retriever',
      'M',
      '2023-01-15',
      31.2,
      'BR-981000442',
      null,
      1,
      null,
      null,
      'Tranquilo',
      offsetDate(-25),
    );

    // Weight history curves
    const insertWeight = db.prepare(`INSERT INTO pet_weights (pet_id, weight_kg, recorded_at, recorded_by) VALUES (?, ?, ?, ?)`);
    insertWeight.run(rexId, 26.8, offsetDate(-120), 'Dra. Fabiele Silva (Ejemplo)');
    insertWeight.run(rexId, 27.9, offsetDate(-45), 'Dra. Fabiele Silva (Ejemplo)');
    insertWeight.run(rexId, 28.5, offsetDate(-1), 'Dra. Fabiele Silva (Ejemplo)');
    insertWeight.run(lunaId, 3.6, offsetDate(-85), 'Dr. Rodrigo Méndez (Ejemplo)');
    insertWeight.run(lunaId, 4.2, offsetDate(-15), 'Dr. Rodrigo Méndez (Ejemplo)');
    insertWeight.run(thorId, 11.4, offsetDate(-75), 'Dra. Fabiele Silva (Ejemplo)');
    insertWeight.run(thorId, 12.0, offsetDate(0), 'Dra. Fabiele Silva (Ejemplo)');
    insertWeight.run(ninaId, 6.8, offsetDate(-60), 'Diego Acosta (Ejemplo)');
    insertWeight.run(ninaId, 7.0, offsetDate(-3), 'Dra. Fabiele Silva (Ejemplo)');

    // 5. Services (7 services in G$ + branch 2 in R$)
    const insertService = db.prepare(`
      INSERT INTO services (store_id, name_es, name_pt, category, duration_min, price)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertService.run(mainStoreId, 'Consulta Clínica General', 'Consulta Clínica Geral', 'clinic', 30, 120000);
    const srvConsultaId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertService.run(mainStoreId, 'Aplicación de Vacuna (Protocolo)', 'Aplicação de Vacina (Protocolo)', 'vaccine', 20, 85000);
    const srvVacinaId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertService.run(mainStoreId, 'Baño & Tosa P (hasta 8 kg)', 'Banho & Tosa P (até 8 kg)', 'grooming', 60, 65000);
    const srvBanhoPId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertService.run(mainStoreId, 'Baño & Tosa M (8–20 kg)', 'Banho & Tosa M (8–20 kg)', 'grooming', 75, 90000);
    const srvBanhoMId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    insertService.run(mainStoreId, 'Baño & Tosa G (+20 kg)', 'Banho & Tosa G (+20 kg)', 'grooming', 90, 120000);
    insertService.run(mainStoreId, 'Táxi Dog Ciudad del Este', 'Táxi Dog Ciudad del Este', 'taxi', 30, 35000);
    insertService.run(mainStoreId, 'Hotel / Guardería 24h', 'Hotel / Creche 24h', 'hotel', 1440, 110000);

    // Branch 2 service
    insertService.run(brStoreId, 'Consulta Veterinária', 'Consulta Veterinária', 'clinic', 30, 150);

    // 6. Store Catalog: 6 categories x 3 products = 18 products in G$
    const insertProduct = db.prepare(`
      INSERT INTO products (store_id, sku, barcode, name_es, name_pt, category, unit, price, cost, stock_qty, min_stock, batch_code, expiry_date, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const productsData: Array<[string, string, string, string, string, string, number, number, number, number, string, string]> = [
      // Alimentos (3)
      ['ALM-001', '7891000100011', 'Ración Adulto Porte Grande 15 kg', 'Ração Adulto Porte Grande 15 kg', 'alimentos', 'bolsa', 285000, 195000, 14, 4, 'LOT-AL26A', offsetDateOnly(240)],
      ['ALM-002', '7891000100028', 'Ración Gatos Castrados Salmón 3 kg', 'Ração Gatos Castrados Salmão 3 kg', 'alimentos', 'bolsa', 115000, 78000, 9, 3, 'LOT-AL26B', offsetDateOnly(190)],
      ['ALM-003', '7891000100035', 'Alimento Húmedo Gastro Recovery 195g', 'Alimento Úmido Gastro Recovery 195g', 'alimentos', 'lata', 32000, 20000, 18, 6, 'LOT-GA91', offsetDateOnly(150)],
      // Medicamentos (3)
      ['MED-001', '7892000200012', 'Amoxicilina + Clavulanato 250mg (10 comp)', 'Amoxicilina + Clavulanato 250mg (10 comp)', 'medicamentos', 'caja', 78000, 46000, 12, 4, 'LOT-AMX44', offsetDateOnly(310)],
      ['MED-002', '7892000200029', 'Antiparasitario Oral Canino 10–25 kg', 'Antiparasitário Oral Canino 10–25 kg', 'medicamentos', 'comp', 95000, 58000, 7, 5, 'LOT-SIM12', offsetDateOnly(270)],
      ['MED-003', '7892000200036', 'Probiótico Pasta Veterinaria 14g', 'Probiótico Pasta Veterinária 14g', 'medicamentos', 'jeringa', 68000, 41000, 4, 5, 'LOT-PRB08', offsetDateOnly(180)], // low stock!
      // Higiene (3)
      ['HIG-001', '7893000300013', 'Shampoo Hipoalergénico Avena 500 ml', 'Shampoo Hipoalergênico Aveia 500 ml', 'higiene', 'frasco', 58000, 32000, 11, 3, 'LOT-HIG02', offsetDateOnly(400)],
      ['HIG-002', '7893000300020', 'Limpiador Auricular Suave 100 ml', 'Limpador Auricular Suave 100 ml', 'higiene', 'frasco', 49000, 27000, 8, 3, 'LOT-OTO15', offsetDateOnly(360)],
      ['HIG-003', '7893000300037', 'Toallitas Húmedas Clorhexidina (50 un)', 'Lenços Umedecidos Clorexidina (50 un)', 'higiene', 'paquete', 36000, 19000, 15, 4, 'LOT-CLX21', offsetDateOnly(300)],
      // Juguetes (3)
      ['JUG-001', '7894000400014', 'Mordedor Caucho Natural Rellenable M', 'Mordedor Borracha Natural Recheável M', 'juguetes', 'unidad', 54000, 29000, 10, 3, 'LOT-JUG11', offsetDateOnly(720)],
      ['JUG-002', '7894000400021', 'Cuerda Algodón Trenzada 2 Nudos', 'Corda Algodão Trançada 2 Nós', 'juguetes', 'unidad', 35000, 18000, 13, 3, 'LOT-JUG12', offsetDateOnly(720)],
      ['JUG-003', '7894000400038', 'Vara con Plumas y Cascabel Felino', 'Varinha com Penas e Guizo Felino', 'juguetes', 'unidad', 29000, 14000, 12, 3, 'LOT-JUG19', offsetDateOnly(720)],
      // Accesorios (3)
      ['ACC-001', '7895000500015', 'Pretal Ergonómico Antitirones Talle G', 'Peitoral Ergonômico Antipuxão Tam G', 'accesorios', 'unidad', 110000, 62000, 6, 2, 'LOT-ACC01', offsetDateOnly(900)],
      ['ACC-002', '7895000500022', 'Comedero Acero Inoxidable Antideslizante', 'Comedouro Aço Inox Antiderrapante', 'accesorios', 'unidad', 48000, 26000, 9, 3, 'LOT-ACC05', offsetDateOnly(900)],
      ['ACC-003', '7895000500039', 'Transportadora Ventilada Mediana', 'Caixa de Transporte Ventilada Média', 'accesorios', 'unidad', 195000, 125000, 3, 2, 'LOT-ACC09', offsetDateOnly(900)],
      // Farmacia (3)
      ['FAR-001', '7896000600016', 'Suero Ringer Lactato 500 ml + Equipo', 'Soro Ringer Lactato 500 ml + Equipo', 'farmacia', 'frasco', 28000, 14000, 22, 8, 'LOT-SRL77', offsetDateOnly(280)],
      ['FAR-002', '7896000600023', 'Gotas Óticas Antimicóticas 15 ml', 'Gotas Otológicas Antimicóticas 15 ml', 'farmacia', 'frasco', 64000, 38000, 7, 3, 'LOT-GOT04', offsetDateOnly(210)],
      ['FAR-003', '7896000600030', 'Collar Isabelino N° 4 (12-15 kg)', 'Colar Elizabetano Nº 4 (12-15 kg)', 'farmacia', 'unidad', 42000, 22000, 5, 2, 'LOT-COL44', offsetDateOnly(900)],
    ];

    let firstFoodProductId = 0;
    let firstMedProductId = 0;
    for (const p of productsData) {
      insertProduct.run(
        mainStoreId,
        p[0],
        p[1],
        p[2],
        p[3],
        p[4],
        p[5],
        p[6],
        p[7],
        p[8],
        p[9],
        p[10],
        p[11],
        '/src/assets/images/product_showcase_vet_1795016853222.jpg',
      );
      const pid = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
      if (p[0] === 'ALM-001') firstFoodProductId = pid;
      if (p[0] === 'MED-003') firstMedProductId = pid;
    }

    // 7. Packages
    db.prepare(`
      INSERT INTO packages (store_id, tutor_id, pet_id, name_es, name_pt, total_sessions, used_sessions, price, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mainStoreId, tutor3Id, ninaId, 'Plan 4 Baños Mensuales (P)', 'Plano 4 Banhos Mensais (P)', 4, 2, 220000, offsetDateOnly(45));
    const ninaPackageId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // 8. Consultations (1-2 per pet) + Addenda + Prescriptions + Clinical Documents
    const insertConsult = db.prepare(`
      INSERT INTO consultations (
        store_id, pet_id, vet_id, vet_name, vet_reg, appointment_id, visit_date,
        subjective, objective_exam, temp_c, heart_rate, resp_rate, weight_kg,
        assessment_dx, cid_vet, plan_conduct, return_date, signed_at, is_locked
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    // Rex Consultation 1 (earlier)
    insertConsult.run(
      mainStoreId,
      rexId,
      vet1Id,
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      null,
      offsetDate(-45, '10:30:00'),
      'Control preventivo anual y actualización vacunal. Tutor refiere buen apetito y deposiciones normales.',
      'Mucosas rosadas, TPC < 2s, auscultación cardiopulmonar sin alteraciones, linfonodos palpables normales.',
      38.4,
      88,
      20,
      27.9,
      'Paciente clínicamente sano — Control preventivo',
      'Z00.0-VET',
      'Refuerzo V10 anual aplicado. Mantener desparasitación trimestral.',
      offsetDateOnly(320),
      offsetDate(-45, '11:05:00'),
    );

    // Rex Consultation 2 (recent, with ready-to-print prescription + exam + addendum)
    insertConsult.run(
      mainStoreId,
      rexId,
      vet1Id,
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      null,
      offsetDate(-1, '15:15:00'),
      'Tutor relata 2 episodios de vómito bilioso en las últimas 18 horas y leve hiporexia tras ingerir restos de comida casera. Sin diarrea sanguinolenta.',
      'Alerta, hidratación conservada (pliegue < 2s), mucosas rosadas, abdomen levemente sensible a la palpación epigástrica. RECORDATORIO CRÍTICO: Alergia documentada a Dipirona.',
      38.6,
      92,
      22,
      28.5,
      'Gastroenteritis aguda leve (indiscreción alimentaria)',
      'K52.9-VET',
      'Dieta blanda gastroentérica por 5 días en porciones pequeñas, protector gástrico (Omeprazol), probiótico oral y antiemético seguro (Maropitant — evitar Dipirona).',
      offsetDateOnly(4),
      offsetDate(-1, '15:50:00'),
    );
    const rexConsult2Id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    // Addendum on Rex Consultation 2 demonstrating immutability
    db.prepare(`
      INSERT INTO consultation_addenda (consultation_id, author_id, author_name, author_role, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      rexConsult2Id,
      vet1Id,
      'Dra. Fabiele Silva (Ejemplo)',
      'vet',
      'Adendo telefónico: Tutor informa que Rex toleró la primera ración húmeda gastro sin nuevos vómitos después de 6 horas.',
      offsetDate(-1, '21:10:00'),
    );

    // Ready-to-print A4 Prescription for Rex
    db.prepare(`
      INSERT INTO prescriptions (consultation_id, pet_id, vet_name, vet_reg, type, valid_until, instructions, created_at)
      VALUES (?, ?, ?, ?, 'normal', ?, ?, ?)
    `).run(
      rexConsult2Id,
      rexId,
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      offsetDateOnly(15),
      'ALERTA CLÍNICA: Paciente alérgico a Dipirona (Metamizol). Administrar medicación con alimento suave luego de 30 minutos del protector gástrico.',
      offsetDate(-1, '15:48:00'),
    );
    const rexRxId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    const insertRxItem = db.prepare(`
      INSERT INTO prescription_items (prescription_id, medication_name, dose_mg_kg, calculated_dose, route, frequency, duration_days, quantity_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertRxItem.run(rexRxId, 'Omeprazol Vet 20 mg', 0.7, '20 mg (1 comp) — calculado para 28,5 kg', 'Oral (VO)', 'Cada 24 horas (en ayunas)', 5, '1 caja x 10 comp.');
    insertRxItem.run(rexRxId, 'Maropitant Citrato 60 mg', 2.0, '57 mg (~1 comp de 60 mg) — 28,5 kg', 'Oral (VO)', 'Cada 24 horas', 3, '1 blíster x 4 comp.');
    insertRxItem.run(rexRxId, 'Probiótico Pasta Veterinaria', null, '4 ml por toma', 'Oral (VO)', 'Cada 12 horas', 5, '1 jeringa dosificadora 14g');

    // Attached Exam PDF + Clinical Report for Rex
    const insertDoc = db.prepare(`
      INSERT INTO clinical_documents (store_id, pet_id, consultation_id, doc_type, title, content, file_url, released_to_tutor, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertDoc.run(
      mainStoreId,
      rexId,
      rexConsult2Id,
      'exam_pdf',
      'Hemograma Completo + Bioquímica Hepatorrenal (Ejemplo PDF)',
      'Resultado de laboratorio (Datos de ejemplo): Eritrocitos 6.8 M/µL (ref 5.5-8.5), Hematocrito 44%, Leucocitos 11.200/µL, ALT 42 U/L, Creatinina 1.1 mg/dL. Valores dentro de parámetros fisiológicos.',
      'demo://hemograma-rex-ejemplo.pdf',
      1,
      'Dra. Fabiele Silva (Ejemplo)',
      offsetDate(-1, '16:15:00'),
    );
    insertDoc.run(
      mainStoreId,
      rexId,
      rexConsult2Id,
      'report',
      'Laudo Clínico — Evolución Gastrointestinal Favorable',
      'Paciente Rex (Canino, 28,5 kg) atendido en Mascotas & Cia por cuadro agudo gastrointestinal autolimitado. Hemograma y perfil bioquímico sin alteraciones sistémicas. Pronóstico favorable con manejo dietético y antiemético.',
      null,
      1,
      'Dra. Fabiele Silva (Ejemplo)',
      offsetDate(-1, '16:30:00'),
    );

    // Luna Consultation
    insertConsult.run(
      mainStoreId,
      lunaId,
      vet2Id,
      'Dr. Rodrigo Méndez (Ejemplo)',
      'SENACSA-VET 0619-PY (Ficticio)',
      null,
      offsetDate(-15, '14:00:00'),
      'Revisión felina anual y control de peso post-castración.',
      'Pelaje brillante, condición corporal 5/9, cavidad oral limpia, sin sarro significativo.',
      38.5,
      160,
      28,
      4.2,
      'Felino saludable — Plan vacunal en seguimiento',
      'Z00.0-VET',
      'Programar refuerzo de Triple Felina en 30 días. Dieta para gatos castrados.',
      offsetDateOnly(15),
      offsetDate(-15, '14:25:00'),
    );

    // Thor Consultation
    insertConsult.run(
      mainStoreId,
      thorId,
      vet1Id,
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      null,
      offsetDate(0, '08:20:00'),
      'Ingreso por decaimiento leve y episodio de deshidratación moderada tras paseo con golpe de calor.',
      'Mucosas levemente hiperémicas, TPC 2.5s, leve jadeo al ingreso, temperatura 39.4 °C. Se indica hidratación parenteral y monitoreo 24h en Box 02.',
      39.4,
      118,
      36,
      12.0,
      'Deshidratación leve / Estrés térmico en observación',
      'T67.0-VET',
      'Fluidoterapia Ringer Lactato IV, control térmico horario y actualización urgente de vacuna antirrábica tras el alta.',
      offsetDateOnly(2),
      offsetDate(0, '08:45:00'),
    );
    const thorConsultId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    db.prepare(`
      INSERT INTO prescriptions (consultation_id, pet_id, vet_name, vet_reg, type, valid_until, instructions, created_at)
      VALUES (?, ?, ?, ?, 'normal', ?, ?, ?)
    `).run(
      thorConsultId,
      thorId,
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      offsetDateOnly(10),
      'Uso hospitalario y continuación ambulatoria tras alta.',
      offsetDate(0, '08:44:00'),
    );
    const thorRxId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
    insertRxItem.run(thorRxId, 'Solución Ringer Lactato IV', null, '40 ml/kg/día (480 ml/24h)', 'Intravenosa (IV)', 'Infusión continua 20 ml/h', 1, '1 frasco 500 ml');

    // Nina Consultation
    insertConsult.run(
      mainStoreId,
      ninaId,
      vet2Id,
      'Dr. Rodrigo Méndez (Ejemplo)',
      'SENACSA-VET 0619-PY (Ficticio)',
      null,
      offsetDate(-3, '11:00:00'),
      'Chequeo dermatológico previo al baño mensual.',
      'Piel íntegra, sin eritema ni lesiones pruriginosas. Oídos limpios.',
      38.3,
      104,
      24,
      7.0,
      'Piel sana — Apta para estética hipoalergénica',
      'Z00.0-VET',
      'Continuar baño mensual con shampoo de avena sin perfume alcohólico.',
      null,
      offsetDate(-3, '11:20:00'),
    );

    // 9. Vaccines (Rex up to date, Thor OVERDUE antirrábica, Luna due in 15 days, Nina up to date)
    const insertVaccine = db.prepare(`
      INSERT INTO vaccines (store_id, pet_id, protocol_code, vaccine_name, dose_number, applied_date, next_due_date, batch_code, manufacturer, vet_name, vet_reg, reminded_at, reminded_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertVaccine.run(
      mainStoreId,
      rexId,
      'CAN-V10',
      'Polivalente V10 (Óctuple/Décuple)',
      'Refuerzo Anual',
      offsetDateOnly(-35),
      offsetDateOnly(330),
      'V10-2609A',
      'Zoetis (Ejemplo)',
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      null,
      null,
    );
    insertVaccine.run(
      mainStoreId,
      thorId,
      'CAN-RAB',
      'Antirrábica Canina',
      'Refuerzo Anual',
      offsetDateOnly(-387),
      offsetDateOnly(-22), // OVERDUE by 22 days (red!)
      'RAB-2501X',
      'Boehringer (Ejemplo)',
      'Dra. Fabiele Silva (Ejemplo)',
      'SENACSA-VET 0482-PY (Ficticio)',
      null,
      null,
    );
    insertVaccine.run(
      mainStoreId,
      lunaId,
      'FEL-TRI',
      'Triple Felina (FVRCP)',
      '2ª Dosis / Refuerzo',
      offsetDateOnly(-350),
      offsetDateOnly(15), // DUE IN 15 DAYS!
      'FEL-2511B',
      'MSD Animal Health (Ejemplo)',
      'Dr. Rodrigo Méndez (Ejemplo)',
      'SENACSA-VET 0619-PY (Ficticio)',
      null,
      null,
    );
    insertVaccine.run(
      mainStoreId,
      ninaId,
      'CAN-V10',
      'Polivalente V10 + Tos de las Perreras',
      'Refuerzo Anual',
      offsetDateOnly(-60),
      offsetDateOnly(305),
      'V10-2604K',
      'Zoetis (Ejemplo)',
      'Dr. Rodrigo Méndez (Ejemplo)',
      'SENACSA-VET 0619-PY (Ficticio)',
      null,
      null,
    );

    // 10. Appointments (Week schedule with consultas, baños, and a surgery)
    const insertAppt = db.prepare(`
      INSERT INTO appointments (store_id, pet_id, tutor_id, professional_id, service_id, type, start_time, end_time, status, queue_ticket, notes, is_squeeze_in)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
    insertAppt.run(mainStoreId, rexId, tutor1Id, vet1Id, srvConsultaId, 'retorno', offsetDate(0, '09:30:00'), offsetDate(0, '10:00:00'), 'checked_in', 'A-04', 'Control post-gastroenteritis', );
    insertAppt.run(mainStoreId, ninaId, tutor3Id, groomerId, srvBanhoPId, 'banho_tosa', offsetDate(0, '10:00:00'), offsetDate(0, '11:00:00'), 'completed', 'B-02', 'Shampoo hipoalergénico de avena');
    insertAppt.run(mainStoreId, lunaId, tutor1Id, vet2Id, srvVacinaId, 'vacina', offsetDate(0, '14:30:00'), offsetDate(0, '14:50:00'), 'scheduled', null, 'Evaluación pre-vacunal Triple Felina');
    insertAppt.run(mainStoreId, thorId, tutor2Id, vet1Id, srvConsultaId, 'cirurgia', offsetDate(2, '09:00:00'), offsetDate(2, '10:30:00'), 'scheduled', null, 'Limpieza dental ultrasónica (Profilaxis)');
    insertAppt.run(mainStoreId, rexId, tutor1Id, groomerId, srvBanhoMId, 'banho_tosa', offsetDate(3, '15:00:00'), offsetDate(3, '16:30:00'), 'scheduled', null, 'Baño higiénico');

    // 11. Hospitalization (Thor in Box 02 with 24h execution map — 1 overdue dose!)
    db.prepare(`
      INSERT INTO hospitalizations (store_id, pet_id, box_code, risk_level, admitted_at, status, care_plan, attending_vet)
      VALUES (?, ?, 'BOX-02 (Monitoreo)', 'moderate', ?, 'active', ?, ?)
    `).run(
      mainStoreId,
      thorId,
      offsetDate(0, '08:30:00'),
      'Fluidoterapia IV 20 ml/h, control térmico cada 4h, dieta hídrica fraccionada.',
      'Dra. Fabiele Silva (Ejemplo)',
    );
    const hospId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    const insertHospTask = db.prepare(`
      INSERT INTO hospitalization_tasks (hospitalization_id, title, scheduled_time, frequency_hours, status, executed_at, executed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    // Past due task (today 06:00 or 2h ago) so it displays in RED as overdue!
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const inTwoHours = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
    const fourHoursAgo = new Date(Date.now() - 4 * 3600 * 1000).toISOString();

    insertHospTask.run(hospId, 'Control de temperatura y mucosas', fourHoursAgo, 4, 'done', fourHoursAgo, 'Dra. Fabiele Silva (Ejemplo)');
    insertHospTask.run(hospId, 'Ranitidina 2 mg/kg IV + Chequeo vía', twoHoursAgo, 8, 'pending', null, null); // OVERDUE RED!
    insertHospTask.run(hospId, 'Ringer Lactato — Cambio de frasco (20 ml/h)', inTwoHours, 6, 'pending', null, null);

    db.prepare(`
      INSERT INTO hospitalization_notes (hospitalization_id, author_name, shift, note, created_at)
      VALUES (?, ?, 'day', ?, ?)
    `).run(hospId, 'Dra. Fabiele Silva (Ejemplo)', 'Ingreso estable, sin vómitos, aceptó 30 ml de agua fresca tras 2 horas de fluidoterapia.', fourHoursAgo);

    // Scheduled Surgery
    db.prepare(`
      INSERT INTO surgeries (store_id, pet_id, surgeon_name, surgery_name, scheduled_at, fasting_hours, anesthetic_protocol, checklist_json, status)
      VALUES (?, ?, ?, ?, ?, 8, ?, ?, 'scheduled')
    `).run(
      mainStoreId,
      thorId,
      'Dra. Fabiele Silva (Ejemplo)',
      'Profilaxis Dental Ultrasónica',
      offsetDate(2, '09:00:00'),
      'Premedicación Acepromazina + Propofol inducción + Isoflurano mantenimiento',
      JSON.stringify({ preExamsOk: true, consentSigned: false, fastingConfirmed: false, ivAccess: false }),
    );

    // 12. Grooming Kanban (Nina READY for delivery!)
    db.prepare(`
      INSERT INTO grooming_orders (store_id, pet_id, tutor_id, service_id, groomer_name, status, taxi_dog, taxi_fee, package_id, photo_ready_url, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'ready', 0, 0, ?, ?, ?, ?)
    `).run(
      mainStoreId,
      ninaId,
      tutor3Id,
      srvBanhoPId,
      'Diego Acosta (Ejemplo)',
      ninaPackageId,
      '/src/assets/images/pet_nina_dog_1795016853802.jpg',
      'Baño hipoalergénico + corte higiénico + lazo verde. Listo para entregar.',
      offsetDate(0, '09:45:00'),
    );

    db.prepare(`
      INSERT INTO grooming_orders (store_id, pet_id, tutor_id, service_id, groomer_name, status, taxi_dog, taxi_fee, package_id, photo_ready_url, notes, created_at)
      VALUES (?, ?, ?, ?, ?, 'in_progress', 1, 35000, NULL, NULL, ?, ?)
    `).run(
      mainStoreId,
      rexId,
      tutor1Id,
      srvBanhoMId,
      'Diego Acosta (Ejemplo)',
      'Retirado con Táxi Dog. Deslanado suave.',
      offsetDate(0, '11:00:00'),
    );

    // 13. Open Comanda (Ração + Banho in same comanda!) + 1 Closed Sale today
    db.prepare(`
      INSERT INTO comandas (store_id, tutor_id, pet_id, status, subtotal, discount, total, created_at)
      VALUES (?, ?, ?, 'open', 350000, 0, 350000, ?)
    `).run(mainStoreId, tutor1Id, rexId, offsetDate(0, '10:15:00'));
    const openComandaId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    const insertComandaItem = db.prepare(`
      INSERT INTO comanda_items (comanda_id, item_type, ref_id, description, qty, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    insertComandaItem.run(openComandaId, 'product', firstFoodProductId, 'Ración Adulto Porte Grande 15 kg', 1, 285000, 285000);
    insertComandaItem.run(openComandaId, 'service', srvBanhoPId, 'Baño & Tosa P (Luna / complemento)', 1, 65000, 65000);

    // Closed sale today so Dashboard "Vendas do dia" shows real data
    db.prepare(`
      INSERT INTO comandas (store_id, tutor_id, pet_id, status, subtotal, discount, total, payment_method, fiscal_ref, created_at, paid_at)
      VALUES (?, ?, ?, 'paid', 188000, 0, 188000, 'pix', 'PY-DOC-000104 (Ejemplo)', ?, ?)
    `).run(mainStoreId, tutor3Id, ninaId, offsetDate(0, '09:10:00'), offsetDate(0, '09:20:00'));
    const paidComandaId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
    insertComandaItem.run(paidComandaId, 'service', srvConsultaId, 'Consulta Clínica General', 1, 120000, 120000);
    insertComandaItem.run(paidComandaId, 'product', firstMedProductId, 'Probiótico Pasta Veterinaria 14g', 1, 68000, 68000);

    // 14. Financial Entries
    const insertFin = db.prepare(`
      INSERT INTO financial_entries (store_id, type, category, description, amount, due_date, paid_date, status, professional_id, commission_pct)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertFin.run(mainStoreId, 'income', 'Clínica + Tienda', 'Comanda #' + paidComandaId + ' — Lucas Ferreira (Ejemplo)', 188000, offsetDateOnly(0), offsetDateOnly(0), 'paid', vet2Id, 20);
    insertFin.run(mainStoreId, 'income', 'Clínica', 'Consulta + Exámenes Rex — Mateo Benítez', 340000, offsetDateOnly(-1), offsetDateOnly(-1), 'paid', vet1Id, 25);
    insertFin.run(mainStoreId, 'income', 'Paquetes', 'Plan 4 Baños Nina — Lucas Ferreira', 220000, offsetDateOnly(-5), offsetDateOnly(-5), 'paid', groomerId, 30);
    insertFin.run(mainStoreId, 'expense', 'Proveedores', 'Reposición Alimentos y Farmacia Vet', 490000, offsetDateOnly(5), null, 'pending', null, 0);
    insertFin.run(mainStoreId, 'expense', 'Operativo', 'Insumos estériles y laboratorio', 165000, offsetDateOnly(-2), offsetDateOnly(-2), 'paid', null, 0);

    // 15. Initial Audit Logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (store_id, user_id, user_name, user_role, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run(mainStoreId, vet1Id, 'Dra. Fabiele Silva (Ejemplo)', 'vet', 'CREATE_CONSULTATION', 'consultation', String(rexConsult2Id), JSON.stringify({ pet: 'Rex', locked: true }), offsetDate(-1, '15:50:00'));
    insertAudit.run(mainStoreId, vet1Id, 'Dra. Fabiele Silva (Ejemplo)', 'vet', 'ADD_ADDENDUM', 'consultation', String(rexConsult2Id), JSON.stringify({ pet: 'Rex', note: 'Seguimiento telefónico' }), offsetDate(-1, '21:10:00'));
    insertAudit.run(mainStoreId, groomerId, 'Diego Acosta (Ejemplo)', 'groomer', 'UPDATE_GROOMING_STATUS', 'grooming_order', '1', JSON.stringify({ pet: 'Nina', status: 'ready' }), offsetDate(0, '10:55:00'));

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
