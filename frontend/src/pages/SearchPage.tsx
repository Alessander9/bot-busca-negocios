import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import type { Lead, JobStatus } from '../types';
import MapComponent from '../components/MapComponent';

const categories = [
  'todos los negocios',
  'restaurantes',
  'belleza',
  'salud',
  'veterinarias',
  'talleres',
  'ferreterias',
  'educacion',
  'moda',
  'tecnologia',
  'servicios',
  'hospedaje',
  'eventos',
  'deporte',
  'hogar',
  'retail',
  'transporte',
  'industria',
  'seguridad',
  'finanzas',
  'turismo',
  'comunidad'
];


export default function SearchPage() {
  const [category, setCategory] = useState('todos los negocios');
  const [latitude, setLatitude] = useState(-12.0464);
  const [longitude, setLongitude] = useState(-77.0428);
  const [latitudeStr, setLatitudeStr] = useState('-12.0464');
  const [longitudeStr, setLongitudeStr] = useState('-77.0428');
  const [radiusKm, setRadiusKm] = useState(3);
  const [district, setDistrict] = useState('');

  const [results, setResults] = useState<Lead[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [isMinimized, setIsMinimized] = useState(false);


  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Map and UI States
  const [mapCenter, setMapCenter] = useState<[number, number]>([-12.0464, -77.0428]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showResultsPanel, setShowResultsPanel] = useState(true);

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

  // Expand results panel if new results come in
  useEffect(() => {
    if (results.length > 0) {
      setShowResultsPanel(true);
    }
  }, [results.length]);

  // Synchronize string inputs when numeric coordinates change from map actions
  useEffect(() => {
    setLatitudeStr(String(latitude));
  }, [latitude]);

  useEffect(() => {
    setLongitudeStr(String(longitude));
  }, [longitude]);



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
    setIsMinimized(false);
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
            <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '1rem' }}>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, fontFamily: "'Outfit', sans-serif", background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 50%, #6366f1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🗺️ PROSPECTOR LOCAL
              </h1>
              <p style={{ fontSize: '0.74rem', color: '#8b9bb4', marginTop: '4px', lineHeight: 1.3 }}>
                Buscador geoespacial con cuadrícula inteligente 100m.
              </p>
            </div>

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
                  <input
                    type="text"
                    value={latitudeStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLatitudeStr(val);
                      const parsed = parseFloat(val.replace(',', '.'));
                      if (!isNaN(parsed)) setLatitude(parsed);
                    }}
                    disabled={isSelectionMode || isLoading}
                    style={{
                      opacity: isSelectionMode ? 0.75 : 1,
                      cursor: isSelectionMode ? 'not-allowed' : 'text',
                      background: '#111827',
                      color: '#fff',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '0.65rem 0.8rem',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Longitud</label>
                  <input
                    type="text"
                    value={longitudeStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLongitudeStr(val);
                      const parsed = parseFloat(val.replace(',', '.'));
                      if (!isNaN(parsed)) setLongitude(parsed);
                    }}
                    disabled={isSelectionMode || isLoading}
                    style={{
                      opacity: isSelectionMode ? 0.75 : 1,
                      cursor: isSelectionMode ? 'not-allowed' : 'text',
                      background: '#111827',
                      color: '#fff',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      padding: '0.65rem 0.8rem',
                    }}
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

        {/* Toggle results panel button */}
        {(results.length > 0 || isLoading) && (
          <button
            className="toggle-results-btn"
            style={{ right: showResultsPanel ? '380px' : '20px', transition: 'right 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
            onClick={() => setShowResultsPanel(!showResultsPanel)}
            title={showResultsPanel ? 'Contraer lista de resultados' : 'Expandir lista de resultados'}
          >
            {showResultsPanel ? '▶' : '📊'}
          </button>
        )}

        {/* Right Floating Sidebar Results Panel */}
        {(results.length > 0 || isLoading) && (
          <div className={`floating-results-panel ${showResultsPanel ? '' : 'collapsed'}`}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              
              {/* Header section with title and stats */}
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.85rem' }}>
                <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontFamily: "'Outfit', sans-serif" }}>
                  📦 Prospectos ({filteredResults.length})
                  {isLoading && <span style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: 500 }}>(buscando...)</span>}
                </h2>
                
                {/* Select All Checkbox & Save Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <label className="custom-checkbox-container" style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={filteredResults.length > 0 && filteredResults.every(l => selectedIds[l.external_id])}
                    />
                    <div className="checkmark-box" style={{ width: '16px', height: '16px', borderRadius: '4px' }}></div>
                    <span>Seleccionar todo</span>
                  </label>
                  
                  <button
                    className="btn btn-success"
                    onClick={onSave}
                    disabled={saving || isLoading || Object.values(selectedIds).filter(Boolean).length === 0}
                    style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', borderRadius: '8px', fontWeight: 600 }}
                  >
                    {saving ? 'Guardando...' : `Guardar (${Object.values(selectedIds).filter(Boolean).length})`}
                  </button>
                </div>

                {/* Segmented Filter Control */}
                <div className="segmented-filter-tabs">
                  {(['all', 'no_website', 'has_website'] as const).map(f => (
                    <button key={f}
                      className={`segmented-tab-btn ${webFilter === f ? 'active' : ''}`}
                      onClick={() => setWebFilter(f)}>
                      {f === 'all' ? 'Todos' : f === 'no_website' ? 'Sin Web' : 'Con Web'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable list of cards */}
              <div className="lead-cards-container">
                {filteredResults.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#4b5563', marginTop: '2rem', fontSize: '0.85rem' }}>
                    No se encontraron leads con el filtro actual.
                  </div>
                ) : (
                  filteredResults.map((lead) => {
                    const isSelected = !!selectedIds[lead.external_id];
                    return (
                      <div key={lead.external_id} className={`lead-result-card ${isSelected ? 'selected' : ''}`}>
                        <div className="lead-card-header">
                          <label className="custom-checkbox-container" style={{ flexGrow: 1 }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(lead.external_id)}
                            />
                            <div className="checkmark-box"></div>
                            <span className="lead-card-title">{lead.business_name}</span>
                          </label>
                          <span className={`score-indicator ${(lead.lead_score ?? 0) >= 70 ? 'score-high' : (lead.lead_score ?? 0) >= 40 ? 'score-med' : 'score-low'}`} style={{ transform: 'scale(0.85)', transformOrigin: 'top right', flexShrink: 0 }}>
                            {lead.lead_score ?? 0}
                          </span>
                        </div>

                        <div className="lead-card-meta">
                          <span className="lead-meta-badge">
                            🏷️ {lead.category ? lead.category.replace('_', ' ') : 'Negocio'}
                          </span>
                          {lead.rating && lead.rating > 0 ? (
                            <span className="lead-rating-badge">
                              ⭐ {lead.rating.toFixed(1)} <span className="lead-rating-reviews">({lead.reviews_count ?? 0})</span>
                            </span>
                          ) : (
                            <span style={{ color: '#4b5563', fontSize: '0.72rem' }}>Sin opiniones</span>
                          )}
                        </div>

                        {lead.business_introduction && (
                          <div className="lead-card-intro">
                            💬 "{lead.business_introduction}"
                          </div>
                        )}

                        <div className="lead-card-body">
                          <div className="lead-info-row">
                            <span className="lead-info-icon">📞</span>
                            <span>{lead.phone ?? <em style={{ color: '#4b5563' }}>Sin teléfono</em>}</span>
                            <span style={{ marginLeft: 'auto' }}>
                              {lead.has_website ? (
                                <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Con Web</span>
                              ) : (
                                <span className="badge badge-yellow" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Sin Web</span>
                              )}
                            </span>
                          </div>
                          
                          <div className="lead-info-row" style={{ alignItems: 'flex-start' }}>
                            <span className="lead-info-icon" style={{ marginTop: '2px' }}>📍</span>
                            <span style={{ fontSize: '0.74rem', color: '#6b7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={lead.address ?? ''}>
                              {lead.address ? lead.address : 'Dirección no disponible'}
                            </span>
                          </div>
                        </div>

                        <div className="lead-card-actions">
                          <div>
                            {lead.phone ? (
                              <a
                                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)', color: '#34d399', fontWeight: 600 }}
                              >
                                💬 WhatsApp
                              </a>
                            ) : (
                              <span style={{ fontSize: '0.72rem', color: '#4b5563' }}>Sin WhatsApp</span>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: '6px' }}>
                            {lead.raw_tags?.social_link && (
                              <a
                                href={lead.raw_tags.social_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary"
                                style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}
                              >
                                🔗 Red
                              </a>
                            )}
                            <button
                              onClick={() => lead.latitude && lead.longitude && setMapCenter([lead.latitude, lead.longitude])}
                              disabled={!lead.latitude || !lead.longitude}
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px', fontWeight: 500 }}
                              title="Centrar en el mapa"
                            >
                              🎯 Centrar
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}


      </div>

      {/* Sleek Floating Scan Progress Widget (Minimized State) */}
      {isLoading && isMinimized && (
        <div className="glass-progress-minimized-widget">
          <div className="minimized-header">
            <div className="minimized-title">
              <div className="minimized-radar">
                <div className="minimized-radar-sweep"></div>
                <div className="minimized-radar-center"></div>
              </div>
              <span>Escaneo en curso...</span>
            </div>
            <button
              onClick={() => setIsMinimized(false)}
              className="btn btn-primary"
              style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem', borderRadius: '6px' }}
            >
              🔎 Ver detalles
            </button>
          </div>
          
          {/* Progress bar in widget */}
          <div style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #7c3aed, #10b981)',
              transition: 'width 0.4s ease',
            }} />
          </div>

          <div className="minimized-stats">
            <span>Progreso: <strong>{progressPct}%</strong> ({completedCells}/{totalCells})</span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>🟢 {totalFound} leads</span>
          </div>
        </div>
      )}

      {/* Premium Glassmorphic Progress Modal Overlay (Maximized State) */}
      {isLoading && !isMinimized && (
        <div className="glass-progress-overlay">
          <div className="glass-progress-modal" style={{ position: 'relative' }}>
            {/* Sleek Minimize Button at top-right */}
            <button
              onClick={() => setIsMinimized(true)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '8px',
                color: '#9ca3af',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.4rem 0.7rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#9ca3af';
              }}
              title="Minimizar y explorar mapa/leads en vivo"
            >
              🗕 Ocultar al fondo
            </button>

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

