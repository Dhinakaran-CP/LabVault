import { ArrowRight, FlaskConical, KeyRound, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../lib/api";

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", adminCode: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account = await register(form);
      navigate(account.role === "admin" ? "/admin" : "/dashboard", { replace: true });
    } catch (err) {
      setError(getApiError(err, "Unable to create your account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-indigo-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-20 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
        <Link to="/login" className="relative z-10 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"><FlaskConical /></span><span className="font-display text-xl font-extrabold">LabVault</span></Link>
        <div className="relative z-10 max-w-xl">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-indigo-200">Learn by doing</p>
          <h1 className="font-display text-5xl font-extrabold leading-[1.12] tracking-tight xl:text-6xl">Bring your next experiment to life.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-indigo-100">Book the tools you need and spend more time building, testing, and discovering.</p>
        </div>
        <p className="relative z-10 text-sm text-indigo-200">Campus labs, made accessible.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Link to="/login" className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><FlaskConical /></span><span className="font-display text-lg font-extrabold">LabVault</span></Link></div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-indigo-600">Get started</p>
          <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-slate-900">Create your account</h2>
          <p className="mt-2 text-slate-500">Join your campus equipment community.</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span><span className="relative block"><UserRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Morgan" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span><span className="relative block"><Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@university.edu" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><span className="relative block"><LockKeyhole className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></span><span className="mt-1.5 block text-xs text-slate-400">Use at least 8 characters.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Admin registration code</span><span className="relative block"><KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input required autoComplete="off" value={form.adminCode} onChange={(e) => setForm({ ...form, adminCode: e.target.value })} placeholder="Get this code from your administrator" className="w-full rounded-xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></span><span className="mt-1.5 block text-xs text-slate-400">This connects your account to the administrator who provided the code.</span></label>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60">{busy ? "Creating account…" : "Create account"} {!busy && <ArrowRight size={17} />}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link className="font-bold text-indigo-600 hover:text-indigo-700" to="/login">Sign in</Link></p>
        </div>
      </section>
    </main>
  );
}
