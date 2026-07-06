import type { DashboardMetrics, Lead, SearchRequest, SearchJob } from './types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Google Maps grid search (async)
  startGridSearch: (payload: SearchRequest) =>
    request<{ jobId: string; status: string }>('/search-googlemaps', { method: 'POST', body: JSON.stringify(payload) }),
  getSearchJob: (jobId: string) =>
    request<SearchJob>(`/search-status/${jobId}`),

  // Save / manage leads
  saveLeads: (leads: Lead[]) =>
    request<Lead[]>('/leads/save', { method: 'POST', body: JSON.stringify(leads) }),
  getLeads: () => request<Lead[]>('/leads'),
  updateLead: (id: string, payload: Partial<Lead>) =>
    request<Lead>(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getDashboard: () => request<DashboardMetrics>('/dashboard'),
};

