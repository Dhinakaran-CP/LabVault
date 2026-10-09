import { FlaskConical, LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const home = user?.role === "admin" ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={home} className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <FlaskConical size={21} strokeWidth={2.2} />
          </span>
          <span>
            <span className="font-display block text-[17px] font-extrabold tracking-tight text-slate-900">LabVault</span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:block">Campus resources</span>
          </span>
        </Link>
        <button className="rounded-lg p-2 text-slate-600 md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
        <div className={`${menuOpen ? "absolute left-0 right-0 top-[72px] flex border-b border-slate-200 bg-white p-4 shadow-lg" : "hidden"} flex-col gap-4 md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
          {user && <NavLink onClick={() => setMenuOpen(false)} to={home} className={({ isActive }) => `text-sm font-semibold ${isActive ? "text-indigo-700" : "text-slate-500 hover:text-slate-900"}`}>Dashboard</NavLink>}
          {user && (
            <div className="flex items-center gap-3 border-t border-slate-100 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <div className="hidden text-right sm:block">
                <p className="max-w-40 truncate text-sm font-bold text-slate-800">{user.name}</p>
                <p className="text-[11px] font-semibold capitalize text-slate-400">{user.role} account</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold uppercase text-indigo-700">{user.name?.charAt(0) || "U"}</span>
              <button onClick={logout} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600" title="Log out">
                <LogOut size={17} /><span className="md:hidden">Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
