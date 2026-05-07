import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { isAuthenticated, clearToken } from "./auth";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import TenantDetail from "./pages/TenantDetail";
import TenantsAdmin from "./pages/TenantsAdmin";

function ProtectedRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function Sidebar() {
  const link = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors";
  const active = "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-700 text-white";

  return (
    <aside className="w-56 shrink-0 bg-brand-900 flex flex-col min-h-screen">
      <div className="px-4 py-5 border-b border-indigo-800">
        <span className="text-white font-bold text-lg tracking-tight">Eduthing</span>
        <p className="text-indigo-400 text-xs mt-0.5">Chromebook EOL</p>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        <NavLink to="/" end className={({ isActive }) => (isActive ? active : link)}>
          <span>📊</span> Dashboard
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? active : link)}>
          <span>⚙️</span> Customers
        </NavLink>
      </nav>
      <div className="px-4 py-3 border-t border-indigo-800 flex items-center justify-between">
        <p className="text-indigo-500 text-xs">v1.0 · {new Date().getFullYear()}</p>
        <button
          onClick={() => { clearToken(); window.location.href = "/login"; }}
          className="text-indigo-400 hover:text-white text-xs transition-colors"
        >
          Sign out
        </button>
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
