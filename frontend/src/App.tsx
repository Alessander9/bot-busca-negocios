import { Navigate, Route, Routes, Link, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import SearchPage from './pages/SearchPage';
import LeadsPage from './pages/LeadsPage';

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link className={active ? 'nav-link active' : 'nav-link'} to={to}>
      {children}
    </Link>
  );
}

export default function App() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-section">
          <div className="brand">✨ Prospector Local</div>
          <p className="brand-desc">Búsqueda y gestión inteligente de leads locales.</p>
        </div>
        <nav className="nav">
          <NavLink to="/dashboard">📊 Dashboard</NavLink>
          <NavLink to="/search">🔍 Buscar</NavLink>
          <NavLink to="/leads">🎯 Leads</NavLink>
        </nav>
        <div className="sidebar-footer">
          V1.2.0 • COSTO S/0
        </div>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/leads" element={<LeadsPage />} />
        </Routes>
      </main>
    </div>
  );
}
