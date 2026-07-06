import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { Lead, JobStatus } from '../types';
import MapComponent from '../components/MapComponent';

const categories = ['todos los negocios', 'restaurantes', 'barberias', 'veterinarias', 'talleres', 'ferreterias', 'consultorios'];

export default function SearchPage() {
  const [category, setCategory] = useState('todos los negocios');
  const [latitude, setLatitude] = useState(-12.0464);
  const [longitude, setLongitude] = useState(-77.0428);
  const [radiusKm, setRadiusKm] = useState(3);
  const [district, setDistrict] = useState('');

  const [results, setResults] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Map and UI States
  const [mapCenter, setMapCenter] = useState<[number, number]>([-12.0464, -77.0428]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showSheet, setShowSheet] = useState(false);

  // Filter
  const [webFilter, setWebFilter] = useState<'all' | 'no_website' | 'has_website'>('all');
  const [mode, setMode] = useState<'basic' | 'complete'>('basic');
  const [customCategory, setCustomCategory] = useState('');

  // Grid search job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [totalCells, setTotalCells] = useState(0);
  const [completedCells, setCompletedCells] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isLoading = jobStatus === 'PENDING' || jobStatus === 'RUNNING';

  // Stop polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), []);

  // Expand bottom sheet if new results come in
  useEffect(() => {
    if (results.length > 0) {
      setShowSheet(true);
    }
  }, [results.length]);

  // Filtered results list helper
  const filteredResults = results.filter((lead) => {
    if (webFilter === 'no_website') return !lead.has_website;
    if (webFilter === 'has_website') return lead.has_website;
    return true;
  });

  const startPolling = (id: string) => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const job = await api.getSearchJob(id);
        setJobStatus(job.status);
        setTotalCells(job.totalCells);
        setCompletedCells(job.completedCells);
        setTotalFound(job.totalFound);

        if (job.partialResults && job.partialResults.length > 0) {
          setResults(job.partialResults);
          // Auto-select leads without website
          const newSelected: Record<string, boolean> = {};
          job.partialResults.forEach((l) => {
            if (!l.has_website) newSelected[l.external_id] = true;
          });
          setSelectedIds(newSelected);
        }

        if (job.status === 'DONE' || job.status === 'ERROR') {
          stopPolling();
          if (job.status === 'ERROR') {
            setError(`Error en búsqueda: ${job.errorMessage ?? 'Error desconocido'}`);
          }
        }
      } catch (e: any) {
        setError(e.message ?? String(e));
        stopPolling();
      }
    }, 4000);
  };

  const onSearch = async () => {
    setError('');
    setSuccessMsg('');
    setResults([]);
    setSelectedIds({});
    setJobId(null);
    setJobStatus(null);
    setTotalCells(0);
    setCompletedCells(0);
    setTotalFound(0);
    stopPolling();

    const searchStr = category === 'custom' ? customCategory.trim() : category;
    if (!searchStr) {
      setError('Por favor especifica un rubro comercial para buscar.');
      return;
    }

    try {
      const { jobId: id } = await api.startGridSearch({
        category: searchStr,
        latitude,
        longitude,
        radiusKm,
        mode
      });
      setJobId(id);
      setJobStatus('PENDING');
      setMapCenter([latitude, longitude]);
      startPolling(id);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextSelected: Record<string, boolean> = {};
    if (e.target.checked) {
      filteredResults.forEach((l) => { nextSelected[l.external_id] = true; });
    }
    setSelectedIds(nextSelected);
  };

  const handleToggleSelect = (externalId: string) => {
    setSelectedIds(prev => ({ ...prev, [externalId]: !prev[externalId] }));
  };

  const onSave = async () => {
    const leadsToSave = filteredResults.filter(l => selectedIds[l.external_id]);
    if (leadsToSave.length === 0) { setError('Selecciona al menos un lead para guardar.'); return; }
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await api.saveLeads(leadsToSave);
      setSuccessMsg(`¡Éxito! Se guardaron ${leadsToSave.length} leads en la base de datos.`);
      setResults(prev => prev.filter(l => !selectedIds[l.external_id]));
      setSelectedIds({});
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // Progress percentage
  const progressPct = totalCells > 0 ? Math.round((completedCells / totalCells) * 100) : 0;

  const statusLabel = () => {
    if (jobStatus === 'PENDING') return 'Inicializando navegador seguro...';
    if (jobStatus === 'RUNNING') return `Explorando cuadrante ${completedCells} de ${totalCells}...`;
    if (jobStatus === 'DONE') return `¡Búsqueda finalizada con éxito!`;
    return '';
  };

  return (
    <section style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1>Buscador de Negocios</h1>
          <p className="header-desc">
            Buscador geoespacial con cuadrícula inteligente 100m y evasión de bloqueos.
          </p>
        </div>
      </header>

      {error && <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
      {successMsg && (
        <div className="alert" style={{ background: '#064e3b', borderColor: '#059669', color: '#ecfdf5', marginBottom: '1rem' }}>
          {successMsg}
        </div>
      )}

      {/* Main Protagonist Layout */}
      <div className="search-view-layout">
        {/* Toggle panel button */}
        <button
          className="toggle-inputs-btn"
          style={{ left: showPanel ? '340px' : '20px', transition: 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
          onClick={() => setShowPanel(!showPanel)}
          title={showPanel ? 'Contraer panel de control' : 'Expandir panel de control'}
        >
          {showPanel ? '◀' : '⚙️'}
        </button>

        {/* Floating parameters panel */}
        <div className={`floating-control-panel ${showPanel ? '' : 'collapsed'}`}>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
              ⚙️ Controles de Búsqueda
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label>Rubro Comercial</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isLoading}>
                  {categories.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  <option value="custom">OTRO (ESPECIFICAR...)</option>
                </select>
              </div>

              {category === 'custom' && (
                <div className="form-group" style={{ marginTop: '-4px' }}>
                  <label>Especificar Término / Rubro</label>
                  <input
                    type="text"
                    placeholder="Ej. gimnasios, farmacias, panaderías"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.8rem',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      background: '#111827',
                      color: '#fff',
                    }}
                  />
                </div>
              )}

              {/* Mode selector */}
              <div className="form-group">
                <label>Modo de Búsqueda</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => !isLoading && setMode('basic')}
                    disabled={isLoading}
                    style={{
                      flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid',
                      cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
                      transition: 'all 0.2s',
                      background: mode === 'basic' ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : '#111827',
                      borderColor: mode === 'basic' ? '#a78bfa' : '#374151',
                      color: mode === 'basic' ? '#fff' : '#9ca3af',
                    }}
                  >
                    ⚡ Básica
                    <div style={{ fontSize: '0.65rem', fontWeight: 400, marginTop: '2px', opacity: 0.85 }}>~50 min</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => !isLoading && setMode('complete')}
                    disabled={isLoading}
                    style={{
                      flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid',
                      cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: '0.8rem', fontWeight: 600,
                      transition: 'all 0.2s',
                      background: mode === 'complete' ? 'linear-gradient(135deg,#059669,#047857)' : '#111827',
                      borderColor: mode === 'complete' ? '#34d399' : '#374151',
                      color: mode === 'complete' ? '#fff' : '#9ca3af',
                    }}
                  >
                    🔥 Completa
                    <div style={{ fontSize: '0.65rem', fontWeight: 400, marginTop: '2px', opacity: 0.85 }}>&lt;100m · 15-18z</div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Ubicación Geográfica</label>
                <button
                  type="button"
                  className={`btn ${isSelectionMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem' }}
                  onClick={() => setIsSelectionMode(!isSelectionMode)}
                  disabled={isLoading}
                >
                  {isSelectionMode ? '🎯 Fijar en Mapa' : '📍 Usar Manual'}
                </button>
              </div>

              {isSelectionMode && (
                <p style={{ fontSize: '0.7rem', color: '#a78bfa', marginTop: '-8px', lineHeight: '1.3' }}>
                  Haz clic en el mapa o arrastra el marcador 🎯 para definir el centro de búsqueda.
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Latitud</label>
                  <input type="number" step="any" value={latitude}
                    onChange={(e) => setLatitude(Number(e.target.value))}
                    disabled={isSelectionMode || isLoading}
                    style={{ opacity: isSelectionMode ? 0.75 : 1, cursor: isSelectionMode ? 'not-allowed' : 'text' }}
                  />
                </div>
                <div className="form-group">
                  <label>Longitud</label>
                  <input type="number" step="any" value={longitude}
                    onChange={(e) => setLongitude(Number(e.target.value))}
                    disabled={isSelectionMode || isLoading}
                    style={{ opacity: isSelectionMode ? 0.75 : 1, cursor: isSelectionMode ? 'not-allowed' : 'text' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '10px' }}>
                <div className="form-group">
                  <label>Radio (km)</label>
                  <input type="number" min="1" max="10" value={radiusKm}
                    onChange={(e) => setRadiusKm(Number(e.target.value))} disabled={isLoading} />
                </div>
                <div className="form-group">
                  <label>Distrito</label>
                  <input type="text" placeholder="Ej. Miraflores" value={district}
                    onChange={(e) => setDistrict(e.target.value)} disabled={isLoading} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '20px' }}>
            <button className="btn" onClick={onSearch} disabled={isLoading} style={{ width: '100%', padding: '0.85rem' }}>
              {isLoading ? '🔍 Buscando...' : '🚀 Iniciar Escaneo'}
            </button>
          </div>
        </div>

        {/* Map taking up the full layout background */}
        <div className="map-full-protagonist">
          <MapComponent
            leads={filteredResults}
            center={mapCenter}
            radiusKm={radiusKm}
            isSelectionMode={isSelectionMode}
            onCenterChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
              setMapCenter([lat, lng]);
            }}
          />
        </div>

        {/* Bottom Drawer Slide-up Panel for Results */}
        {(results.length > 0 || isLoading) && (
          <div className={`results-bottom-sheet ${showSheet ? 'expanded' : ''}`}>
            {/* Sheet Handle */}
            <div className="sheet-handle-bar" onClick={() => setShowSheet(!showSheet)}>
              <div className="sheet-handle-pill" />
              <div style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 600, marginTop: '4px', letterSpacing: '0.5px' }}>
                {showSheet ? '▼ COLAPSAR TABLA' : `▲ VER LISTADO (${filteredResults.length} leads)`}
              </div>
            </div>

            {/* Inner Content */}
            <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 24px)', overflow: 'hidden', marginTop: '10px' }}>
              <div className="flex-between mb-1" style={{ flexWrap: 'wrap', gap: '15px', alignItems: 'flex-end', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.85rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📦 Prospectos Detectados
                    {isLoading && <span style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: 500 }}>(actualizando…)</span>}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>Filtrar por Sitio Web:</span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['all', 'no_website', 'has_website'] as const).map(f => (
                        <button key={f}
                          className={`btn ${webFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => setWebFilter(f)}>
                          {f === 'all' ? 'Todos' : f === 'no_website' ? 'Sin Web' : 'Con Web'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button className="btn btn-success" onClick={onSave} disabled={saving || isLoading} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px' }}>
                  {saving ? 'Guardando leads...' : `Guardar Seleccionados (${Object.values(selectedIds).filter(Boolean).length})`}
                </button>
              </div>

              {/* Table Container */}
              <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '40px', textAlign: 'center' }}>
                        <input type="checkbox" onChange={handleSelectAll}
                          checked={filteredResults.length > 0 && filteredResults.every(l => selectedIds[l.external_id])}
                          style={{ cursor: 'pointer' }} />
                      </th>
                      <th>Nombre</th>
                      <th>Teléfono</th>
                      <th>Sitio Web</th>
                      <th>Score</th>
                      <th>Dirección</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResults.map((lead) => (
                      <tr key={lead.external_id}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={!!selectedIds[lead.external_id]}
                            onChange={() => handleToggleSelect(lead.external_id)}
                            style={{ cursor: 'pointer' }} />
                        </td>
                        <td style={{ fontWeight: 600, color: '#f3f4f6' }}>{lead.business_name}</td>
                        <td>{lead.phone ?? <span style={{ color: '#4b5563' }}>-</span>}</td>
                        <td>
                          {lead.has_website ? (
                            <span className="badge badge-green">Con Web</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className="badge badge-yellow" style={{ width: 'fit-content' }}>Sin Web</span>
                              {lead.raw_tags?.social_link && (
                                <a href={lead.raw_tags.social_link} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: '0.72rem', color: '#a78bfa', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '2px', width: 'fit-content' }}>
                                  🔗 Red Social
                                </a>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`score-indicator ${(lead.lead_score ?? 0) >= 70 ? 'score-high' : (lead.lead_score ?? 0) >= 40 ? 'score-med' : 'score-low'}`}>
                            {lead.lead_score ?? 0}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                          {lead.address ? `${lead.address}${lead.district ? ', ' + lead.district : ''}` : <span style={{ color: '#4b5563' }}>-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Premium Glassmorphic Progress Modal Overlay */}
      {isLoading && (
        <div className="glass-progress-overlay">
          <div className="glass-progress-modal">
            {/* Spinning Radar Spinner */}
            <div className="radar-wrapper">
              <div className="radar-outer-ring"></div>
              <div className="radar-inner-sweep"></div>
              <div className="radar-pulse-center"></div>
            </div>

            <h3 style={{ marginBottom: '8px', color: '#fff', fontSize: '1.25rem', fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>
              🗺️ Escaneo en Cuadrícula Activo
            </h3>
            <p style={{ color: '#9ca3af', fontSize: '0.82rem', marginBottom: '20px', lineHeight: 1.4 }}>
              Barrido de zona con espaciado <span style={{ color: '#a78bfa', fontWeight: 600 }}>&lt;100m</span> y evasión de bloqueos en Google Maps.
            </p>

            {/* Progress bar */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.85rem' }}>
                <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                  Búsqueda {completedCells} / {totalCells > 0 ? totalCells : '?'}
                </span>
                <span style={{ color: '#10b981', fontWeight: 600 }}>{progressPct}%</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '8px', height: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #7c3aed, #10b981)',
                  borderRadius: '8px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            {/* Glowing found leads counter */}
            <div style={{
              background: '#020617',
              borderRadius: '16px',
              padding: '1rem',
              marginBottom: '1rem',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.05)',
            }}>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10b981', textShadow: '0 0 10px rgba(16,185,129,0.4)', letterSpacing: '-1px' }}>
                {totalFound}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                negocios detectados hasta ahora
              </div>
            </div>

            <p style={{ fontWeight: 500, color: '#a78bfa', fontSize: '0.85rem', minHeight: '20px' }}>
              {statusLabel()}
            </p>

            {/* Micro-Terminal progress logs */}
            <div className="progress-terminal">
              <div className="progress-terminal-line">
                $ python scraper/google_maps_scraper.py --grid --mode {mode}
              </div>
              <div className="progress-terminal-line" style={{ color: '#10b981', marginTop: '4px' }}>
                &gt; Celda activa: {completedCells + 1}/{totalCells} @ {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </div>
              <div className="progress-terminal-line" style={{ color: '#38bdf8', marginTop: '4px' }}>
                &gt; Estado: {statusLabel()}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

