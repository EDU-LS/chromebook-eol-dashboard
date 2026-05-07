import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import TenantDetail from "./pages/TenantDetail";
import TenantsAdmin from "./pages/TenantsAdmin";

function Sidebar() {
  const link =
    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-indigo-200 hover:bg-indigo-700 hover:text-white transition-colors";
  const active =
    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-700 text-white";

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
      <div className="px-4 py-3 border-t border-indigo-800">
        <p className="text-indigo-500 text-xs">v1.0 · {new Date().getFullYear()}</p>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
