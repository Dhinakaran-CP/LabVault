import { ArrowRight, FlaskConical, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../lib/api";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account = await login(form);
      navigate(account.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      setError(getApiError(err, "Unable to sign in."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-28 -top-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-20 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
        <Link to="/" className="relative z-10 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500"><FlaskConical /></span><span className="font-display text-xl font-extrabold">LabVault</span></Link>
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">Your campus, equipped</p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.12] tracking-tight xl:text-6xl">Great ideas need the right tools.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">Discover, reserve, and make more of your campus laboratories — all in one place.</p>
        </div>
        <p className="relative z-10 text-sm text-slate-400">A smarter way to access shared resources.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden"><Link to="/" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><FlaskConical /></span><span className="font-display text-lg font-extrabold">LabVault</span></Link></div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-600">Welcome back</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Sign in to LabVault</h2>
          <p className="mt-2 text-slate-500">Access your bookings and campus equipment.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span><span className="relative block"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@university.edu" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><span className="relative block"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></span></label>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">{busy ? "Signing in…" : "Sign in"} {!busy && <ArrowRight size={17} />}</button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">New to LabVault? <Link className="font-bold text-indigo-600 hover:text-indigo-700" to="/register">Create an account</Link></p>
        </div>
      </section>
    </main>
  );
}
