import { useEffect, useState } from 'react';
import { api } from '../api';
import type { DashboardMetrics } from '../types';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const pctSinWeb = data && data.total_leads > 0 
    ? Math.round((data.leads_sin_website / data.total_leads) * 100) 
    : 0;

  const pctCalificados = data && data.total_leads > 0 
    ? Math.round((data.leads_calificados / data.total_leads) * 100) 
    : 0;

  return (
    <section>
      <header className="header">
        <div>
          <h1>Dashboard</h1>
          <p className="header-desc">Visión analítica del progreso y conversión de prospectos.</p>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="panel" style={{ textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(139, 92, 246, 0.1)', borderTopColor: '#8b5cf6', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: '#9ca3af', fontSize: '0.95rem', fontWeight: 500 }}>Cargando métricas de conversión comercial...</p>
        </div>
      ) : (
        <>
          <div className="grid">
            <div className="card">
              <div className="card-title">Total Leads</div>
              <div className="metric">{data?.total_leads ?? 0}</div>
            </div>
            <div className="card sin-web">
              <div className="card-title">Sin Página Web</div>
              <div className="metric" style={{ color: '#fbbf24' }}>{data?.leads_sin_website ?? 0}</div>
            </div>
            <div className="card" style={{ boxShadow: '0 4px 20px rgba(16, 185, 129, 0.05)' }}>
              <div className="card-title">Calificados</div>
              <div className="metric" style={{ color: '#34d399' }}>{data?.leads_calificados ?? 0}</div>
            </div>
            <div className="card">
              <div className="card-title">Contactados</div>
              <div className="metric">{data?.leads_contactados ?? 0}</div>
            </div>
            <div className="card">
              <div className="card-title">Interesados</div>
              <div className="metric" style={{ color: '#a78bfa' }}>{data?.leads_interesados ?? 0}</div>
            </div>
            <div className="card" style={{ boxShadow: '0 4px 20px rgba(139, 92, 246, 0.05)' }}>
              <div className="card-title">Cerrados / Clientes</div>
              <div className="metric" style={{ color: '#8b5cf6' }}>{data?.leads_cerrados ?? 0}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }} className="mb-2">
            <div className="panel">
              <h2>📈 Métricas de Conversión y Cobertura</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '1.5rem' }}>
                <div>
                  <div className="flex-between mb-1" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                    <span>Proporción de Negocios sin Sitio Web</span>
                    <span style={{ color: '#fbbf24' }}>{pctSinWeb}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pctSinWeb}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #3b82f6)', borderRadius: '4px' }}></div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '8px' }}>Negocios locales calificados que representan una oportunidad directa de desarrollo web.</p>
                </div>

                <div>
                  <div className="flex-between mb-1" style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                    <span>Calidad de Leads (Calificación Comercial Alta)</span>
                    <span style={{ color: '#34d399' }}>{pctCalificados}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pctCalificados}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)', borderRadius: '4px' }}></div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '8px' }}>Prospectos con datos completos (teléfono, dirección, horario y sin web) ideales para contacto.</p>
                </div>
              </div>
            </div>

            <div className="panel">
              <h2>🏷️ Distribución por Rubro</h2>
              {data && Object.keys(data.leads_por_rubro).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '1.5rem' }}>
                  {Object.entries(data.leads_por_rubro).map(([category, count]) => {
                    const maxVal = Math.max(...Object.values(data.leads_por_rubro));
                    const percentage = maxVal > 0 ? Math.round((count / maxVal) * 100) : 0;
                    return (
                      <div key={category}>
                        <div className="flex-between mb-1" style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>
                          <span style={{ fontWeight: 500 }}>{category}</span>
                          <span style={{ fontWeight: 600, color: '#9ca3af' }}>{count} leads</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6, #6366f1)', borderRadius: '3px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>No hay datos suficientes para clasificar.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
