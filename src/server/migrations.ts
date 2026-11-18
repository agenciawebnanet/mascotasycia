import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  upSql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_relational_schema',
    upSql: `
      CREATE TABLE IF NOT EXISTS stores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        city TEXT NOT NULL,
        country TEXT NOT NULL CHECK(country IN ('PY', 'BR', 'AR')),
        currency TEXT NOT NULL CHECK(currency IN ('PYG', 'BRL', 'ARS')),
        default_lang TEXT NOT NULL CHECK(default_lang IN ('es', 'pt-BR')),
        timezone TEXT NOT NULL,
        accent_color TEXT NOT NULL DEFAULT '#0f766e',
        logo_url TEXT,
        whatsapp TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        tax_id_label TEXT NOT NULL,
        tax_id TEXT NOT NULL,
        fiscal_mode TEXT NOT NULL CHECK(fiscal_mode IN ('PY_DOC_READY', 'BR_NFCE_NFSE', 'AR_AFIP_READY')),
        hours_clinic TEXT NOT NULL,
        hours_grooming TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('reception', 'vet', 'groomer', 'manager', 'tutor')),
        crmv_or_reg TEXT,
        specialty TEXT,
        phone TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS tutors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        document TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        notes TEXT,
        lgpd_consent INTEGER NOT NULL DEFAULT 1,
        lgpd_consent_at TEXT,
        credit_limit REAL NOT NULL DEFAULT 0,
        anonymized INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT,
        name TEXT NOT NULL,
        species TEXT NOT NULL CHECK(species IN ('dog', 'cat', 'other')),
        breed TEXT NOT NULL,
        sex TEXT NOT NULL CHECK(sex IN ('M', 'F')),
        birth_date TEXT NOT NULL,
        weight_kg REAL NOT NULL DEFAULT 0,
        microchip TEXT,
        photo_url TEXT,
        neutered INTEGER NOT NULL DEFAULT 0,
        allergies TEXT,
        chronic_conditions TEXT,
        temperament TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pet_weights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        weight_kg REAL NOT NULL,
        recorded_at TEXT NOT NULL,
        recorded_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        name_es TEXT NOT NULL,
        name_pt TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('clinic', 'vaccine', 'grooming', 'taxi', 'hotel', 'surgery')),
        duration_min INTEGER NOT NULL DEFAULT 30,
        price REAL NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        sku TEXT NOT NULL,
        barcode TEXT NOT NULL,
        name_es TEXT NOT NULL,
        name_pt TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('alimentos', 'medicamentos', 'higiene', 'juguetes', 'accesorios', 'farmacia')),
        unit TEXT NOT NULL,
        price REAL NOT NULL,
        cost REAL NOT NULL DEFAULT 0,
        stock_qty INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER NOT NULL DEFAULT 2,
        batch_code TEXT,
        expiry_date TEXT,
        photo_url TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        name_es TEXT NOT NULL,
        name_pt TEXT NOT NULL,
        total_sessions INTEGER NOT NULL,
        used_sessions INTEGER NOT NULL DEFAULT 0,
        price REAL NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT,
        professional_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
        type TEXT NOT NULL CHECK(type IN ('consulta', 'retorno', 'vacina', 'banho_tosa', 'cirurgia', 'hotel_creche')),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled')),
        queue_ticket TEXT,
        notes TEXT,
        is_squeeze_in INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        vet_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        vet_name TEXT NOT NULL,
        vet_reg TEXT NOT NULL,
        appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
        visit_date TEXT NOT NULL,
        subjective TEXT NOT NULL,
        objective_exam TEXT NOT NULL,
        temp_c REAL,
        heart_rate INTEGER,
        resp_rate INTEGER,
        weight_kg REAL,
        assessment_dx TEXT NOT NULL,
        cid_vet TEXT,
        plan_conduct TEXT NOT NULL,
        return_date TEXT,
        signed_at TEXT NOT NULL,
        is_locked INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS consultation_addenda (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
        author_id INTEGER,
        author_name TEXT NOT NULL,
        author_role TEXT NOT NULL,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consultation_id INTEGER NOT NULL REFERENCES consultations(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        vet_name TEXT NOT NULL,
        vet_reg TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('normal', 'controlled')),
        valid_until TEXT NOT NULL,
        instructions TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS prescription_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE RESTRICT,
        medication_name TEXT NOT NULL,
        dose_mg_kg REAL,
        calculated_dose TEXT NOT NULL,
        route TEXT NOT NULL,
        frequency TEXT NOT NULL,
        duration_days INTEGER NOT NULL,
        quantity_text TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS clinical_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        consultation_id INTEGER REFERENCES consultations(id) ON DELETE SET NULL,
        doc_type TEXT NOT NULL CHECK(doc_type IN ('certificate', 'report', 'surgical_consent', 'exam_pdf')),
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        file_url TEXT,
        released_to_tutor INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS vaccines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        protocol_code TEXT NOT NULL,
        vaccine_name TEXT NOT NULL,
        dose_number TEXT NOT NULL,
        applied_date TEXT NOT NULL,
        next_due_date TEXT NOT NULL,
        batch_code TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        vet_name TEXT NOT NULL,
        vet_reg TEXT NOT NULL,
        reminded_at TEXT,
        reminded_note TEXT
      );

      CREATE TABLE IF NOT EXISTS hospitalizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        box_code TEXT NOT NULL,
        risk_level TEXT NOT NULL CHECK(risk_level IN ('low', 'moderate', 'critical')),
        admitted_at TEXT NOT NULL,
        discharged_at TEXT,
        status TEXT NOT NULL CHECK(status IN ('active', 'discharged', 'deceased')),
        care_plan TEXT NOT NULL,
        attending_vet TEXT NOT NULL,
        outcome_summary TEXT
      );

      CREATE TABLE IF NOT EXISTS hospitalization_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospitalization_id INTEGER NOT NULL REFERENCES hospitalizations(id) ON DELETE RESTRICT,
        title TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        frequency_hours INTEGER NOT NULL DEFAULT 8,
        status TEXT NOT NULL CHECK(status IN ('pending', 'done')),
        executed_at TEXT,
        executed_by TEXT
      );

      CREATE TABLE IF NOT EXISTS hospitalization_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hospitalization_id INTEGER NOT NULL REFERENCES hospitalizations(id) ON DELETE RESTRICT,
        author_name TEXT NOT NULL,
        shift TEXT NOT NULL CHECK(shift IN ('day', 'night')),
        note TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS surgeries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        surgeon_name TEXT NOT NULL,
        surgery_name TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        fasting_hours INTEGER NOT NULL DEFAULT 8,
        anesthetic_protocol TEXT NOT NULL,
        checklist_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('scheduled', 'in_surgery', 'recovery', 'completed'))
      );

      CREATE TABLE IF NOT EXISTS grooming_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        pet_id INTEGER NOT NULL REFERENCES pets(id) ON DELETE RESTRICT,
        tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT,
        service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
        groomer_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('scheduled', 'in_progress', 'ready', 'delivered')),
        taxi_dog INTEGER NOT NULL DEFAULT 0,
        taxi_fee REAL NOT NULL DEFAULT 0,
        package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
        photo_ready_url TEXT,
        notes TEXT,
        comanda_id INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS comandas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        tutor_id INTEGER NOT NULL REFERENCES tutors(id) ON DELETE RESTRICT,
        pet_id INTEGER REFERENCES pets(id) ON DELETE RESTRICT,
        status TEXT NOT NULL CHECK(status IN ('open', 'paid', 'fiado')),
        subtotal REAL NOT NULL DEFAULT 0,
        discount REAL NOT NULL DEFAULT 0,
        total REAL NOT NULL DEFAULT 0,
        payment_method TEXT CHECK(payment_method IN ('pix', 'card', 'cash', 'fiado')),
        fiscal_ref TEXT,
        created_at TEXT NOT NULL,
        paid_at TEXT
      );

      CREATE TABLE IF NOT EXISTS comanda_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comanda_id INTEGER NOT NULL REFERENCES comandas(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK(item_type IN ('service', 'product', 'vaccine', 'hospitalization', 'taxi')),
        ref_id INTEGER,
        description TEXT NOT NULL,
        qty INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT NOT NULL,
        paid_date TEXT,
        status TEXT NOT NULL CHECK(status IN ('paid', 'pending')),
        professional_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        commission_pct REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id INTEGER NOT NULL,
        user_id INTEGER,
        user_name TEXT NOT NULL,
        user_role TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        details_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pets_tutor ON pets(tutor_id);
      CREATE INDEX IF NOT EXISTS idx_consultations_pet ON consultations(pet_id);
      CREATE INDEX IF NOT EXISTS idx_vaccines_next_due ON vaccines(next_due_date);
      CREATE INDEX IF NOT EXISTS idx_appointments_prof_time ON appointments(professional_id, start_time);
      CREATE INDEX IF NOT EXISTS idx_audit_store_time ON audit_logs(store_id, created_at);
    `,
  },
];

export function runMigrations(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const applied = new Set(appliedRows.map((r) => r.version));

  for (const m of MIGRATIONS) {
    if (!applied.has(m.version)) {
      db.exec('BEGIN;');
      try {
        db.exec(m.upSql);
        db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
          m.version,
          m.name,
          new Date().toISOString(),
        );
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }
  }
}
