import { ArrowDownToLine, CalendarDays, Check, Clock3, FlaskConical, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api, { getApiError } from "../lib/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function equipmentName(booking) {
  return booking.equipment?.name || booking.equipmentName || "Equipment";
}

function localDateValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function hasStatus(booking, status) {
  return booking.status?.toLowerCase() === status.toLowerCase();
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ date: "", startTime: "", endTime: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setError("");
    try {
      const [equipmentResponse, bookingsResponse] = await Promise.all([api.get("/equipment"), api.get("/bookings")]);
      setEquipment(Array.isArray(equipmentResponse.data) ? equipmentResponse.data : equipmentResponse.data.equipment || []);
      setBookings(Array.isArray(bookingsResponse.data) ? bookingsResponse.data : bookingsResponse.data.bookings || []);
    } catch (err) {
      setError(getApiError(err, "We couldn't load the dashboard."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const availableEquipment = useMemo(() => equipment.filter((item) => {
    const available = item.available !== false && item.isAvailable !== false;
    return available && `${item.name} ${item.category || ""} ${item.description || ""}`.toLowerCase().includes(search.toLowerCase());
  }), [equipment, search]);

  const openBooking = (item) => {
    setSelected(item);
    setForm({ date: "", startTime: "", endTime: "" });
    setNotice("");
    setError("");
  };

  const bookEquipment = async (event) => {
    event.preventDefault();
    if (form.startTime >= form.endTime) {
      setError("End time must be later than start time.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post("/bookings", { equipment: selected._id, date: form.date, startTime: form.startTime, endTime: form.endTime });
      setSelected(null);
      setNotice("Your booking request was submitted and is pending approval.");
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to submit booking."));
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSlip = async (booking) => {
    setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      const name = equipmentName(booking);
      const date = formatDate(booking.date || booking.startAt);
      const startTime = booking.startTime || new Date(booking.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      const endTime = booking.endTime || new Date(booking.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      pdf.setFillColor(49, 46, 129);
      pdf.rect(0, 0, 210, 48, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("LabVault", 20, 24);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text("CAMPUS LABORATORY BOOKING SLIP", 20, 35);
      pdf.setTextColor(15, 23, 42);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(17);
      pdf.text("Booking confirmation", 20, 68);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const details = [
        ["Student", user?.name || booking.user?.name || "Student"],
        ["Equipment", name],
        ["Date", date],
        ["Time slot", `${startTime} – ${endTime}`],
        ["Booking status", "APPROVED"]
      ];
      details.forEach(([label, value], index) => {
        const y = 88 + index * 17;
        pdf.setTextColor(100, 116, 139);
        pdf.text(label, 20, y);
        pdf.setTextColor(30, 41, 59);
        pdf.setFont("helvetica", "bold");
        pdf.text(String(value), 78, y);
        pdf.setFont("helvetica", "normal");
        pdf.setDrawColor(226, 232, 240);
        pdf.line(20, y + 5, 190, y + 5);
      });
      pdf.setDrawColor(16, 185, 129);
      pdf.setLineWidth(1.4);
      pdf.roundedRect(138, 190, 48, 23, 3, 3);
      pdf.setTextColor(5, 150, 105);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("VERIFIED", 162, 199, { align: "center" });
      pdf.setFontSize(7);
      pdf.text(`LV-${String(booking._id || "BOOKING").slice(-8).toUpperCase()}`, 162, 207, { align: "center" });
      pdf.setTextColor(148, 163, 184);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("Digitally generated by LabVault. Present this slip at the laboratory.", 20, 274);
      pdf.save(`LabVault-booking-${String(booking._id || "slip").slice(-8)}.pdf`);
    } catch (err) {
      setError(getApiError(err, "Unable to generate your booking slip."));
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-soft sm:px-9 sm:py-10">
        <div className="absolute -right-14 -top-28 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-indigo-200"><FlaskConical size={14} /> Student workspace</span><h1 className="font-display mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">Find the right equipment for your next project and reserve a time that works for you.</p></div>
          <div className="flex gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3"><p className="text-xs font-medium text-slate-400">My bookings</p><p className="mt-1 text-2xl font-extrabold">{bookings.length}</p></div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3"><p className="text-xs font-medium text-slate-400">Awaiting approval</p><p className="mt-1 text-2xl font-extrabold">{bookings.filter((booking) => booking.status?.toLowerCase() === "pending").length}</p></div>
          </div>
        </div>
      </section>

      {error && !selected && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {notice && <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><Check size={17} />{notice}</div>}

      <section className="mt-9">
        <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Explore the collection</p><h2 className="font-display mt-1 text-2xl font-extrabold tracking-tight text-slate-900">Available equipment</h2><p className="mt-1 text-sm text-slate-500">Request a slot for the tools your work needs.</p></div><label className="relative block w-full sm:w-64"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} /><input aria-label="Search equipment" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search equipment…" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></label></div>
        {loading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-slate-200" />)}</div> : availableEquipment.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{availableEquipment.map((item, index) => <article key={item._id} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-soft"><div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${["bg-indigo-50 text-indigo-700", "bg-cyan-50 text-cyan-700", "bg-amber-50 text-amber-700", "bg-emerald-50 text-emerald-700"][index % 4]}`}><FlaskConical size={22} /></div><div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /><span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Available</span>{item.category && <span className="ml-auto truncate text-[11px] font-medium text-slate-400">{item.category}</span>}</div><h3 className="font-display text-base font-extrabold leading-snug text-slate-900">{item.name}</h3><p className="mt-2 line-clamp-2 flex-1 text-sm leading-5 text-slate-500">{item.description || item.location || "Campus laboratory equipment available to reserve."}</p><button onClick={() => openBooking(item)} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm font-bold text-indigo-700 transition group-hover:bg-indigo-600 group-hover:text-white">Book a slot <Plus size={16} /></button></article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">No available equipment matches your search.</div>}
      </section>

      <section className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div><h2 className="font-display text-lg font-extrabold text-slate-900">My bookings</h2><p className="mt-1 text-sm text-slate-500">Track your requests and download approved booking slips.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{bookings.length} total</span></div>
        {loading ? <div className="px-6 py-10 text-center text-sm text-slate-400">Loading your bookings…</div> : bookings.length === 0 ? <div className="px-6 py-12 text-center"><CalendarDays className="mx-auto text-slate-300" size={30} /><p className="mt-3 font-semibold text-slate-700">No bookings yet</p><p className="mt-1 text-sm text-slate-500">Your booking requests will show up here.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-6 py-3 font-bold">Equipment</th><th className="px-6 py-3 font-bold">Date</th><th className="px-6 py-3 font-bold">Time slot</th><th className="px-6 py-3 font-bold">Status</th><th className="px-6 py-3 text-right font-bold">Receipt</th></tr></thead><tbody className="divide-y divide-slate-100">{bookings.map((booking) => <tr key={booking._id} className="hover:bg-slate-50/70"><td className="px-6 py-4"><p className="font-bold text-slate-800">{equipmentName(booking)}</p><p className="mt-0.5 text-xs text-slate-400">Ref. {String(booking._id).slice(-8).toUpperCase()}</p></td><td className="px-6 py-4 text-sm font-medium text-slate-600">{formatDate(booking.date || booking.startAt)}</td><td className="px-6 py-4 text-sm text-slate-600"><span className="flex items-center gap-1.5"><Clock3 size={14} className="text-slate-400" />{booking.startTime || new Date(booking.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })} – {booking.endTime || new Date(booking.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span></td><td className="px-6 py-4"><StatusBadge status={booking.status} /></td><td className="px-6 py-4 text-right">{hasStatus(booking, "Approved") ? <button onClick={() => downloadSlip(booking)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-50"><ArrowDownToLine size={14} /> Download slip</button> : <span className="text-xs text-slate-300">—</span>}</td></tr>)}</tbody></table></div>}
      </section>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="booking-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">New reservation</p><h2 id="booking-title" className="font-display mt-1 text-xl font-extrabold text-slate-900">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">Choose the date and time you need.</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X size={19} /></button></div>
        <form onSubmit={bookEquipment} className="mt-6 space-y-4">{error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}<label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Booking date</span><input required type="date" min={localDateValue()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></label><div className="grid grid-cols-2 gap-4"><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Start time</span><input required type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></label><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">End time</span><input required type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" /></label></div><p className="text-xs leading-5 text-slate-400">Requests require administrator approval. Time slots that overlap an existing booking cannot be submitted.</p><div className="flex gap-3 pt-2"><button type="button" onClick={() => setSelected(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button><button disabled={submitting} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">{submitting ? "Submitting…" : "Request booking"}</button></div></form></section></div>}
    </main>
  );
}
