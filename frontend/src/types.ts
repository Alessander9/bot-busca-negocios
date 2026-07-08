export type LeadStatus = 'nuevo' | 'sin_pagina_web' | 'calificado' | 'baja_prioridad' | 'descartado';
export type ContactStatus =
  | 'pendiente_contacto_manual'
  | 'contactado'
  | 'interesado'
  | 'pidio_cotizacion'
  | 'seguimiento'
  | 'cerrado'
  | 'perdido'
  | 'no_contactar'
  | 'numero_invalido';

export type Lead = {
  id?: string;
  external_id: string;
  business_name: string;
  category: string;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  has_website?: boolean;
  opening_hours?: string | null;
  image_url?: string | null;
  lead_score?: number;
  lead_status?: LeadStatus;
  contact_status?: ContactStatus;
  reviews_count?: number;
  rating?: number;
  business_introduction?: string | null;
  notes?: string | null;
  raw_tags?: Record<string, string | null>;
};


export type DashboardMetrics = {
  total_leads: number;
  leads_sin_website: number;
  leads_calificados: number;
  leads_contactados: number;
  leads_interesados: number;
  leads_cerrados: number;
  leads_por_rubro: Record<string, number>;
};

export type SearchRequest = {
  category: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  mode?: 'basic' | 'complete';
  ai_optimize?: boolean;
};

export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';

export type SearchJob = {
  jobId: string;
  status: JobStatus;
  totalCells: number;
  completedCells: number;
  totalFound: number;
  partialResults: Lead[];
  errorMessage?: string;
};

