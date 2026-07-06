import { useEffect, useRef } from 'react';
import type { Lead } from '../types';

declare const L: any;

interface MapComponentProps {
  leads: Lead[];
  center: [number, number];
  radiusKm?: number;
  onMarkerClick?: (lead: Lead) => void;
  isSelectionMode?: boolean;
  onCenterChange?: (lat: number, lng: number) => void;
}

export default function MapComponent({ 
  leads, 
  center, 
  radiusKm, 
  onMarkerClick,
  isSelectionMode = false,
  onCenterChange
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const circleRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Leaflet map
    const map = L.map(mapContainerRef.current).setView(center, 13);
    mapRef.current = map;

    // Google Maps tiles
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; <a href="https://maps.google.com">Google Maps</a>'
    }).addTo(map);



    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Smooth flyTo transitions
  useEffect(() => {
    if (mapRef.current) {
      const currentCenter = mapRef.current.getCenter();
      const dist = Math.abs(currentCenter.lat - center[0]) + Math.abs(currentCenter.lng - center[1]);
      if (dist > 0.0001) {
        mapRef.current.flyTo(center, mapRef.current.getZoom(), {
          duration: 1.2,
          easeLinearity: 0.25
        });
      }
    }
  }, [center]);

  // Center selection marker with ripple wave animation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (centerMarkerRef.current) {
      centerMarkerRef.current.remove();
      centerMarkerRef.current = null;
    }

    if (isSelectionMode) {
      centerMarkerRef.current = L.marker(center, {
        draggable: true,
        icon: L.divIcon({
          html: `
            <div class="custom-center-marker-icon">
              <div class="center-marker-ripple"></div>
              <div class="center-marker-aim">🎯</div>
            </div>
          `,
          className: 'custom-center-icon',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        })
      }).addTo(map);

      centerMarkerRef.current.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        if (onCenterChange) {
          onCenterChange(parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)));
        }
      });
    }

    return () => {
      if (centerMarkerRef.current) {
        centerMarkerRef.current.remove();
        centerMarkerRef.current = null;
      }
    };
  }, [isSelectionMode, center, onCenterChange]);

  // Listen for clicks on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: any) => {
      if (isSelectionMode && onCenterChange) {
        onCenterChange(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)));
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isSelectionMode, onCenterChange]);

  // Update search area circle with animated dashed line class
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (circleRef.current) {
      circleRef.current.remove();
      circleRef.current = null;
    }

    if (radiusKm && radiusKm > 0) {
      circleRef.current = L.circle(center, {
        color: '#8b5cf6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.08,
        radius: radiusKm * 1000,
        className: 'pulsing-map-circle'
      }).addTo(map);
    }
  }, [center, radiusKm]);

  // Manage lead markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const getMarkerIcon = (status?: string) => {
      let color = '#3b82f6';
      if (status === 'calificado') color = '#10b981';
      if (status === 'sin_pagina_web') color = '#f59e0b';
      if (status === 'descartado') color = '#ef4444';
      if (status === 'baja_prioridad') color = '#64748b';

      return L.divIcon({
        html: `
          <div class="map-pin-anchor">
            <div class="map-pin-pulse" style="background: ${color};"></div>
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
    };

    leads.forEach((lead) => {
      if (lead.latitude && lead.longitude) {
        const marker = L.marker([lead.latitude, lead.longitude], {
          icon: getMarkerIcon(lead.lead_status)
        }).addTo(map);

        marker.bindPopup(`
          <div class="custom-popup-content">
            <h4>${lead.business_name}</h4>
            <p class="popup-category">${lead.category}</p>
            <div class="popup-metric-row">
              <span class="popup-label">Score:</span>
              <span class="popup-val score-${(lead.lead_score ?? 0) >= 70 ? 'high' : (lead.lead_score ?? 0) >= 40 ? 'med' : 'low'}">${lead.lead_score ?? 0}</span>
            </div>
            ${lead.rating && lead.rating > 0 ? `
            <div class="popup-metric-row">
              <span class="popup-label">Rating:</span>
              <span class="popup-val" style="color: #f59e0b; font-weight: 600;">⭐ ${lead.rating.toFixed(1)} (${lead.reviews_count ?? 0})</span>
            </div>
            ` : ''}
            <div class="popup-metric-row">
              <span class="popup-label">Tel:</span>
              <span class="popup-val">${lead.phone ?? '-'}</span>
            </div>
            <div class="popup-metric-row">
              <span class="popup-label">Sitio Web:</span>
              <span class="popup-val">${lead.has_website ? '✅ Con Web' : '❌ Sin Web'}</span>
            </div>
          </div>

        `, {
          className: 'custom-leaflet-popup'
        });

        if (onMarkerClick) {
          marker.on('click', () => {
            onMarkerClick(lead);
          });
        }

        markersRef.current.push(marker);
      }
    });

    if (leads.length > 0) {
      const group = new L.featureGroup(markersRef.current.filter(m => m.getLatLng));
      if (markersRef.current.length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
      }
    }
  }, [leads]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        height: '100%', 
        width: '100%', 
        borderRadius: '24px', 
        border: 'none',
        boxShadow: 'none',
        zIndex: 1
      }} 
    />
  );
}

