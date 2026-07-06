import { useEffect, useState } from 'react';
import { api, API_BASE } from '../api';
import type { Lead, LeadStatus, ContactStatus } from '../types';
import MapComponent from '../components/MapComponent';

const leadStatuses: LeadStatus[] = ['nuevo', 'sin_pagina_web', 'calificado', 'baja_prioridad', 'descartado'];
const contactStatuses: ContactStatus[] = [
  'pendiente_contacto_manual',
  'contactado',
  'interesado',
  'pidio_cotizacion',
  'seguimiento',
  'cerrado',
  'perdido',
  'no_contactar',
  'numero_invalido'
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filtering states
  const [searchName, setSearchName] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterLeadStatus, setFilterLeadStatus] = useState('');
  const [filterContactStatus, setFilterContactStatus] = useState('');

  // Modal states
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [editLeadStatus, setEditLeadStatus] = useState<LeadStatus>('nuevo');
  const [editContactStatus, setEditContactStatus] = useState<ContactStatus>('pendiente_contacto_manual');
  const [editNotes, setEditNotes] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  const fetchLeads = () => {
    setLoading(true);
    api.getLeads()
      .then(setLeads)
      .catch((e) => setError(String(e.message ?? e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleEditClick = (lead: Lead) => {
    setActiveLead(lead);
    setEditLeadStatus(lead.lead_status ?? 'nuevo');
    setEditContactStatus(lead.contact_status ?? 'pendiente_contacto_manual');
    setEditNotes(lead.notes ?? '');
  };

  const handleSaveModal = async () => {
    if (!activeLead) return;
    setSavingLead(true);
    setError('');
    setSuccess('');
    try {
      const idToUpdate = activeLead.id ?? activeLead.external_id;
      const updated = await api.updateLead(idToUpdate, {
        lead_status: editLeadStatus,
        contact_status: editContactStatus,
        notes: editNotes
      });
      setSuccess(`Lead "${updated.business_name}" actualizado con éxito.`);
      setActiveLead(null);
      fetchLeads();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSavingLead(false);
    }
  };

  // Filter list of leads locally
  const filteredLeads = leads.filter((lead) => {
    const matchesName = lead.business_name.toLowerCase().includes(searchName.toLowerCase());
    const matchesCategory = filterCategory === '' || lead.category.toLowerCase() === filterCategory.toLowerCase();
    const matchesLeadStatus = filterLeadStatus === '' || lead.lead_status === filterLeadStatus;
    const matchesContactStatus = filterContactStatus === '' || lead.contact_status === filterContactStatus;
    return matchesName && matchesCategory && matchesLeadStatus && matchesContactStatus;
  });

  const getLeadStatusBadgeClass = (status?: LeadStatus) => {
    switch (status) {
      case 'calificado': return 'badge-green';
      case 'sin_pagina_web': return 'badge-yellow';
      case 'nuevo': return 'badge-blue';
      case 'baja_prioridad': return 'badge-gray';
      case 'descartado': return 'badge-red';
      default: return 'badge-gray';
    }
  };

  const getContactStatusBadgeClass = (status?: ContactStatus) => {
    switch (status) {
      case 'cerrado': return 'badge-green';
      case 'interesado':
      case 'pidio_cotizacion':
      case 'seguimiento':
        return 'badge-blue';
      case 'contactado': return 'badge-yellow';
      case 'pendiente_contacto_manual': return 'badge-gray';
      case 'perdido':
      case 'no_contactar':
      case 'numero_invalido':
        return 'badge-red';
      default: return 'badge-gray';
    }
  };

  return (
    <section>
      <header className="header">
        <div>
          <h1>Gestión de Leads</h1>
          <p className="header-desc">Administra el embudo de prospección comercial, cambia estados y añade notas de seguimiento.</p>
        </div>
        <div>
          <a href={`${API_BASE}/export/csv`} className="btn btn-secondary" target="_blank" rel="noopener noreferrer">
            📥 Exportar a CSV
          </a>
        </div>
      </header>

      {error && <div className="alert">{error}</div>}
      {success && <div className="alert" style={{ background: '#064e3b', borderColor: '#059669', color: '#ecfdf5' }}>{success}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '20px', marginBottom: '2rem' }} className="leads-layout-grid">
        <div className="panel" style={{ marginBottom: 0 }}>
          <h2>Filtros y Búsqueda</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label>Buscar por Nombre</label>
              <input 
                type="text" 
                placeholder="Ej. Barbería El Elegante" 
                value={searchName} 
                onChange={(e) => setSearchName(e.target.value)} 
              />
            </div>
            <div className="form-group">
              <label>Rubro</label>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">Todos los rubros</option>
                <option value="restaurantes">Restaurantes</option>
                <option value="barberias">Barberías</option>
                <option value="veterinarias">Veterinarias</option>
                <option value="talleres">Talleres Mecánicos</option>
                <option value="ferreterias">Ferreterías</option>
                <option value="consultorios">Consultorios</option>
              </select>
            </div>
            <div className="form-group">
              <label>Estado Lead</label>
              <select value={filterLeadStatus} onChange={(e) => setFilterLeadStatus(e.target.value)}>
                <option value="">Todos los estados</option>
                {leadStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Estado Comercial</label>
              <select value={filterContactStatus} onChange={(e) => setFilterContactStatus(e.target.value)}>
                <option value="">Todos los contactos</option>
                {contactStatuses.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column' }}>
          <h2>Distribución Espacial (Pines por Estado)</h2>
          <div className="map-card" style={{ flexGrow: 1, minHeight: '300px' }}>
            <MapComponent 
              leads={filteredLeads} 
              center={[-12.0464, -77.0428]} 
              onMarkerClick={handleEditClick}
            />
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="flex-between mb-1">
          <h2>Lista de Leads Guardados ({filteredLeads.length})</h2>
          <button className="btn btn-secondary" onClick={fetchLeads} disabled={loading}>
            🔄 Recargar
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', border: '2px solid rgba(139, 92, 246, 0.1)', borderTopColor: '#8b5cf6', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>Cargando leads guardados...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: '#6b7280' }}>No se encontraron leads con los filtros activos.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rubro</th>
                  <th>Rating</th>
                  <th>Estado Lead</th>
                  <th>Estado Comercial</th>
                  <th>Score</th>
                  <th>Teléfono</th>
                  <th>Ubicación</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => (
                  <tr key={lead.id ?? lead.external_id}>
                    <td style={{ fontWeight: 600, color: '#f3f4f6' }}>{lead.business_name}</td>
                    <td style={{ textTransform: 'capitalize' }}>{lead.category}</td>
                    <td>
                      {lead.rating && lead.rating > 0 ? (
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          ⭐ {lead.rating.toFixed(1)}
                          <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.75rem' }}>({lead.reviews_count ?? 0})</span>
                        </div>
                      ) : (
                        <span style={{ color: '#4b5563' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${getLeadStatusBadgeClass(lead.lead_status)}`}>
                        {lead.lead_status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getContactStatusBadgeClass(lead.contact_status)}`}>
                        {lead.contact_status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <span className={`score-indicator ${
                        (lead.lead_score ?? 0) >= 70 ? 'score-high' : 
                        (lead.lead_score ?? 0) >= 40 ? 'score-med' : 'score-low'
                      }`}>
                        {lead.lead_score ?? 0}
                      </span>
                    </td>
                    <td>{lead.phone ?? <span style={{ color: '#4b5563' }}>-</span>}</td>
                    <td style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                      {lead.district ? `${lead.district}, ${lead.city}` : lead.city}
                    </td>
                    <td>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} onClick={() => handleEditClick(lead)}>
                        Gestionar
                      </button>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over details & update modal */}
      {activeLead && (
        <div className="overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Gestionar Prospecto</h3>
              <button className="modal-close" onClick={() => setActiveLead(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.9rem' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '12px', color: '#fff', fontWeight: 600 }}>{activeLead.business_name}</h4>
                <p style={{ color: '#9ca3af', marginBottom: '6px' }}><strong>Rubro:</strong> <span style={{ textTransform: 'capitalize' }}>{activeLead.category}</span></p>
                {activeLead.address && <p style={{ color: '#9ca3af', marginBottom: '6px' }}><strong>Dirección:</strong> {activeLead.address}</p>}
                {activeLead.phone && <p style={{ color: '#9ca3af', marginBottom: '6px' }}><strong>Teléfono:</strong> {activeLead.phone}</p>}
                {activeLead.email && <p style={{ color: '#9ca3af', marginBottom: '6px' }}><strong>Email:</strong> {activeLead.email}</p>}
                {activeLead.website && <p style={{ color: '#9ca3af', marginBottom: '6px' }}><strong>Sitio Web:</strong> <a href={activeLead.website} target="_blank" rel="noopener noreferrer" style={{ color: '#8b5cf6', textDecoration: 'underline' }}>{activeLead.website}</a></p>}
                <p style={{ color: '#6b7280', fontSize: '0.8rem', marginTop: '12px' }}>
                  <strong>ID Externo:</strong> {activeLead.external_id} (
                  <a 
                    href={activeLead.external_id.startsWith('googlemaps_') ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeLead.business_name + ' ' + (activeLead.address ?? ''))}` : `https://www.openstreetmap.org/${activeLead.external_id.replace('_', '/')}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    style={{ color: '#8b5cf6', textDecoration: 'underline' }}
                  >
                    {activeLead.external_id.startsWith('googlemaps_') ? 'Ver en Google Maps' : 'Ver en OSM'}
                  </a>)
                </p>
              </div>

              <div className="form-group">
                <label>Calificación Interna del Lead</label>
                <select value={editLeadStatus} onChange={(e) => setEditLeadStatus(e.target.value as LeadStatus)}>
                  {leadStatuses.map(s => <option key={s} value={s}>{s.toUpperCase().replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Estado de Contacto Comercial</label>
                <select value={editContactStatus} onChange={(e) => setEditContactStatus(e.target.value as ContactStatus)}>
                  {contactStatuses.map(s => <option key={s} value={s}>{s.toUpperCase().replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Notas de Seguimiento Comercial</label>
                <textarea 
                  rows={4} 
                  placeholder="Escribe comentarios sobre las llamadas, emails o visitas..." 
                  value={editNotes} 
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveLead(null)} disabled={savingLead}>
                Cancelar
              </button>
              <button className="btn btn-success" onClick={handleSaveModal} disabled={savingLead}>
                {savingLead ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
