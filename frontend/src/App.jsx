import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { isAuthenticated, clearToken } from "./auth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import TenantDetail from "./pages/TenantDetail";
import TenantsAdmin from "./pages/TenantsAdmin";
import Suggestions from "./pages/Suggestions";

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function Sidebar() {
  const link = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-brand-200 hover:bg-brand-700 hover:text-white transition-colors";
  const active = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white";

  return (
    <aside className="w-56 shrink-0 bg-brand-900 flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-brand-800">
        <span className="text-white font-bold text-lg tracking-tight">Eduthing</span>
        <p className="text-brand-300 text-xs mt-0.5">Chromebook EOL</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        <NavLink to="/" end className={({ isActive }) => (isActive ? active : link)}>
          <span>📊</span> Dashboard
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? active : link)}>
          <span>⚙️</span> Customers
        </NavLink>
        <NavLink to="/suggestions" className={({ isActive }) => (isActive ? active : link)}>
          <span>💡</span> Ideas
        </NavLink>
      </nav>
      <div className="px-4 py-3 border-t border-brand-800">
        <div className="flex items-center justify-between mb-1">
          <p className="text-brand-400 text-xs">v1.0 · {new Date().getFullYear()}</p>
          <button
            onClick={() => { clearToken(); window.location.href = "/login"; }}
            className="text-brand-400 hover:text-white text-xs transition-colors"
          >
            Sign out
          </button>
        </div>
        <p className="text-brand-600 text-xs">Made by LS @ EDU</p>
      </div>
    </aside>
  );
}

function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tenant/:id" element={<TenantDetail />} />
          <Route path="/admin" element={<TenantsAdmin />} />
          <Route path="/suggestions" element={<Suggestions />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
