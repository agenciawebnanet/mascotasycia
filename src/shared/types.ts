export type AppLanguage = 'es' | 'pt-BR';
export type CurrencyCode = 'PYG' | 'BRL' | 'ARS';
export type CountryCode = 'PY' | 'BR' | 'AR';
export type AppMode = 'demo' | 'prod';

export type UserRole = 'reception' | 'vet' | 'groomer' | 'manager' | 'tutor';

export interface Store {
  id: number;
  code: string;
  name: string;
  city: string;
  country: CountryCode;
  currency: CurrencyCode;
  default_lang: AppLanguage;
  timezone: string;
  accent_color: string;
  logo_url: string | null;
  whatsapp: string;
  phone: string;
  address: string;
  tax_id_label: string;
  tax_id: string;
  fiscal_mode: 'PY_DOC_READY' | 'BR_NFCE_NFSE' | 'AR_AFIP_READY';
  hours_clinic: string;
  hours_grooming: string;
  is_demo: number;
}

export interface StaffUser {
  id: number;
  store_id: number;
  name: string;
  role: UserRole;
  crmv_or_reg: string | null;
  specialty: string | null;
  phone: string | null;
  active: number;
}

export interface Tutor {
  id: number;
  store_id: number;
  name: string;
  document: string;
  phone: string;
  email: string | null;
  address: string | null;
  notes: string | null;
  lgpd_consent: number;
  lgpd_consent_at: string | null;
  credit_limit: number;
  anonymized: number;
  created_at: string;
}

export interface Pet {
  id: number;
  store_id: number;
  tutor_id: number;
  tutor_name?: string;
  tutor_phone?: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed: string;
  sex: 'M' | 'F';
  birth_date: string;
  weight_kg: number;
  microchip: string | null;
  photo_url: string | null;
  neutered: number;
  allergies: string | null;
  chronic_conditions: string | null;
  temperament: string | null;
  created_at: string;
}

export interface PetWeight {
  id: number;
  pet_id: number;
  weight_kg: number;
  recorded_at: string;
  recorded_by: string;
}

export interface ServiceItem {
  id: number;
  store_id: number;
  name_es: string;
  name_pt: string;
  category: 'clinic' | 'vaccine' | 'grooming' | 'taxi' | 'hotel' | 'surgery';
  duration_min: number;
  price: number;
  active: number;
}

export type ProductCategory =
  | 'alimentos'
  | 'medicamentos'
  | 'higiene'
  | 'juguetes'
  | 'accesorios'
  | 'farmacia';

export interface Product {
  id: number;
  store_id: number;
  sku: string;
  barcode: string;
  name_es: string;
  name_pt: string;
  category: ProductCategory;
  unit: string;
  price: number;
  cost: number;
  stock_qty: number;
  min_stock: number;
  batch_code: string | null;
  expiry_date: string | null;
  photo_url: string | null;
  active: number;
}

export interface PetPackage {
  id: number;
  store_id: number;
  tutor_id: number;
  pet_id: number;
  tutor_name?: string;
  pet_name?: string;
  name_es: string;
  name_pt: string;
  total_sessions: number;
  used_sessions: number;
  price: number;
  expires_at: string;
}

export interface Appointment {
  id: number;
  store_id: number;
  pet_id: number;
  tutor_id: number;
  professional_id: number;
  service_id: number | null;
  pet_name?: string;
  pet_species?: string;
  tutor_name?: string;
  tutor_phone?: string;
  professional_name?: string;
  service_name_es?: string;
  service_name_pt?: string;
  type: 'consulta' | 'retorno' | 'vacina' | 'banho_tosa' | 'cirurgia' | 'hotel_creche';
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled';
  queue_ticket: string | null;
  notes: string | null;
  is_squeeze_in: number;
}

export interface ConsultationAddendum {
  id: number;
  consultation_id: number;
  author_id: number | null;
  author_name: string;
  author_role: UserRole;
  note: string;
  created_at: string;
}

export interface PrescriptionItem {
  id?: number;
  prescription_id?: number;
  medication_name: string;
  dose_mg_kg: number | null;
  calculated_dose: string;
  route: string;
  frequency: string;
  duration_days: number;
  quantity_text: string;
}

export interface Prescription {
  id: number;
  consultation_id: number;
  pet_id: number;
  vet_name: string;
  vet_reg: string;
  type: 'normal' | 'controlled';
  valid_until: string;
  instructions: string | null;
  created_at: string;
  items: PrescriptionItem[];
}

export interface Consultation {
  id: number;
  store_id: number;
  pet_id: number;
  vet_id: number | null;
  vet_name: string;
  vet_reg: string;
  appointment_id: number | null;
  visit_date: string;
  subjective: string;
  objective_exam: string;
  temp_c: number | null;
  heart_rate: number | null;
  resp_rate: number | null;
  weight_kg: number | null;
  assessment_dx: string;
  cid_vet: string | null;
  plan_conduct: string;
  return_date: string | null;
  signed_at: string;
  is_locked: number;
  addenda?: ConsultationAddendum[];
  prescriptions?: Prescription[];
}

export interface ClinicalDocument {
  id: number;
  store_id: number;
  pet_id: number;
  consultation_id: number | null;
  doc_type: 'certificate' | 'report' | 'surgical_consent' | 'exam_pdf';
  title: string;
  content: string;
  file_url: string | null;
  released_to_tutor: number;
  created_by: string;
  created_at: string;
}

export interface VaccineRecord {
  id: number;
  store_id: number;
  pet_id: number;
  pet_name?: string;
  pet_species?: string;
  tutor_name?: string;
  tutor_phone?: string;
  protocol_code: string;
  vaccine_name: string;
  dose_number: string;
  applied_date: string;
  next_due_date: string;
  batch_code: string;
  manufacturer: string;
  vet_name: string;
  vet_reg: string;
  reminded_at: string | null;
  reminded_note: string | null;
}

export interface HospitalizationTask {
  id: number;
  hospitalization_id: number;
  title: string;
  scheduled_time: string;
  frequency_hours: number;
  status: 'pending' | 'done';
  executed_at: string | null;
  executed_by: string | null;
}

export interface HospitalizationNote {
  id: number;
  hospitalization_id: number;
  author_name: string;
  shift: 'day' | 'night';
  note: string;
  created_at: string;
}

export interface Hospitalization {
  id: number;
  store_id: number;
  pet_id: number;
  pet_name?: string;
  pet_species?: string;
  pet_weight?: number;
  pet_allergies?: string | null;
  tutor_name?: string;
  tutor_phone?: string;
  box_code: string;
  risk_level: 'low' | 'moderate' | 'critical';
  admitted_at: string;
  discharged_at: string | null;
  status: 'active' | 'discharged' | 'deceased';
  care_plan: string;
  attending_vet: string;
  outcome_summary: string | null;
  tasks: HospitalizationTask[];
  notes: HospitalizationNote[];
}

export interface SurgeryRecord {
  id: number;
  store_id: number;
  pet_id: number;
  pet_name?: string;
  tutor_name?: string;
  surgeon_name: string;
  surgery_name: string;
  scheduled_at: string;
  fasting_hours: number;
  anesthetic_protocol: string;
  checklist_json: string;
  status: 'scheduled' | 'in_surgery' | 'recovery' | 'completed';
}

export interface GroomingOrder {
  id: number;
  store_id: number;
  pet_id: number;
  tutor_id: number;
  service_id: number;
  pet_name?: string;
  pet_breed?: string;
  pet_photo?: string | null;
  tutor_name?: string;
  tutor_phone?: string;
  service_name_es?: string;
  service_name_pt?: string;
  service_price?: number;
  groomer_name: string;
  status: 'scheduled' | 'in_progress' | 'ready' | 'delivered';
  taxi_dog: number;
  taxi_fee: number;
  package_id: number | null;
  photo_ready_url: string | null;
  notes: string | null;
  comanda_id: number | null;
  created_at: string;
}

export interface ComandaItem {
  id: number;
  comanda_id: number;
  item_type: 'service' | 'product' | 'vaccine' | 'hospitalization' | 'taxi';
  ref_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  total_price: number;
}

export interface Comanda {
  id: number;
  store_id: number;
  tutor_id: number;
  pet_id: number | null;
  tutor_name?: string;
  tutor_phone?: string;
  tutor_credit_limit?: number;
  pet_name?: string;
  status: 'open' | 'paid' | 'fiado';
  subtotal: number;
  discount: number;
  total: number;
  payment_method: 'pix' | 'card' | 'cash' | 'fiado' | null;
  fiscal_ref: string | null;
  created_at: string;
  paid_at: string | null;
  items: ComandaItem[];
}

export interface FinancialEntry {
  id: number;
  store_id: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'paid' | 'pending';
  professional_id: number | null;
  professional_name?: string | null;
  commission_pct: number;
}

export interface AuditLog {
  id: number;
  store_id: number;
  user_id: number | null;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details_json: string;
  created_at: string;
}
