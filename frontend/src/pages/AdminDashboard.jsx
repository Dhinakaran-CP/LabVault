import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Activity, Check, CirclePlus, Clock3, Cpu, KeyRound, PackageCheck, Pencil, RefreshCw, Save, UserPlus, UsersRound, X } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { useEffect, useMemo, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import api, { getApiError } from "../lib/api";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const asArray = (data, key) => Array.isArray(data) ? data : data?.[key] || [];
const nameOfEquipment = (booking) => booking.equipment?.name || booking.equipmentName || "Equipment";

function Metric({ label, value, detail, icon: Icon, color }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="font-display mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</p></div><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}><Icon size={21} /></span></div><p className="mt-4 text-xs font-medium text-slate-400">{detail}</p></article>;
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState({ name: "", category: "", location: "", description: "" });
  const [editingEquipmentId, setEditingEquipmentId] = useState("");
  const [editEquipmentForm, setEditEquipmentForm] = useState({ name: "", category: "", description: "", location: "" });
  const [students, setStudents] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [registrationCode, setRegistrationCode] = useState("");
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  const loadData = async () => {
    setError("");
    try {
      const [bookingResponse, equipmentResponse, studentResponse, adminResponse] = await Promise.all([
        api.get("/bookings"),
        api.get("/equipment"),
        api.get("/admin/students"),
        api.get("/admin/admins")
      ]);
      setBookings(asArray(bookingResponse.data, "bookings"));
      setEquipment(asArray(equipmentResponse.data, "equipment"));
      setStudents(asArray(studentResponse.data, "students"));
      setAdmins(asArray(adminResponse.data, "admins"));
    } catch (err) {
      setError(getApiError(err, "We couldn't load the admin dashboard."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  const pending = useMemo(() => bookings.filter((booking) => booking.status?.toLowerCase() === "pending"), [bookings]);
  const activeEquipment = equipment.filter((item) => item.available !== false && item.isAvailable !== false).length;
  const counts = useMemo(() => equipment.map((item) => ({
    name: item.name,
    count: bookings.filter((booking) => String(booking.equipment?._id || booking.equipment || booking.equipmentId) === String(item._id)).length
  })), [equipment, bookings]);

  const chartData = {
    labels: counts.map((item) => item.name),
    datasets: [{
      label: "Bookings",
      data: counts.map((item) => item.count),
      backgroundColor: "rgba(99, 102, 241, 0.82)",
      hoverBackgroundColor: "rgba(79, 70, 229, 0.95)",
      borderRadius: 7,
      maxBarThickness: 46
    }]
  };
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: "#0f172a", padding: 12, cornerRadius: 9 } },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: "#64748b", font: { size: 11 } } },
      y: { beginAtZero: true, ticks: { precision: 0, stepSize: 1, color: "#94a3b8" }, grid: { color: "#f1f5f9" }, border: { display: false } }
    }
  };

  const updateStatus = async (booking, status) => {
    setBusyId(booking._id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/bookings/${booking._id}/status`, { status: status.toLowerCase() });
      setNotice(`Booking ${status.toLowerCase()} successfully.`);
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to update booking status."));
    } finally {
      setBusyId("");
    }
  };

  const createEquipment = async (event) => {
    event.preventDefault();
    setSavingEquipment(true);
    setError("");
    try {
      await api.post("/equipment", { ...equipmentForm, category: equipmentForm.category || "General", location: equipmentForm.location || "Campus Lab" });
      setEquipmentForm({ name: "", category: "", location: "", description: "" });
      setShowForm(false);
      setNotice("Equipment added to the catalog.");
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to add equipment."));
    } finally {
      setSavingEquipment(false);
    }
  };

  const toggleEquipment = async (item) => {
    const currentlyAvailable = item.available !== false && item.isAvailable !== false;
    setBusyId(item._id);
    setError("");
    try {
      await api.patch(`/equipment/${item._id}/availability`, { available: !currentlyAvailable });
      setNotice(`${item.name} marked ${currentlyAvailable ? "unavailable" : "available"}.`);
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to update equipment."));
    } finally {
      setBusyId("");
    }
  };

  const startEditingEquipment = (item) => {
    setEditingEquipmentId(item._id);
    setEditEquipmentForm({
      name: item.name || "",
      category: item.category || "",
      description: item.description || "",
      location: item.location || ""
    });
    setError("");
  };

  const saveEquipmentChanges = async (event, equipmentId) => {
    event.preventDefault();
    setBusyId(equipmentId);
    setError("");
    try {
      await api.patch(`/equipment/${equipmentId}`, editEquipmentForm);
      setEditingEquipmentId("");
      setNotice("Equipment details updated.");
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to update equipment details."));
    } finally {
      setBusyId("");
    }
  };

  const createAdmin = async (event) => {
    event.preventDefault();
    setSavingAdmin(true);
    setError("");
    try {
      await api.post("/admin/admins", adminForm);
      setAdminForm({ name: "", email: "", password: "" });
      setNotice("Administrator account created. Share the sign-in credentials securely.");
      setSavingAdmin(false);
      try {
        const { data } = await api.get("/admin/admins");
        setAdmins(asArray(data, "admins"));
      } catch (err) {
        setError(getApiError(err, "Administrator created, but the administrator list could not be refreshed."));
      }
    } catch (err) {
      setError(getApiError(err, "Unable to create administrator account."));
    } finally {
      setSavingAdmin(false);
    }
  };

  const generateRegistrationCode = async () => {
    setGeneratingCode(true);
    setError("");
    setRegistrationCode("");
    try {
      const { data } = await api.post("/admin/registration-code");
      setRegistrationCode(data.registrationCode);
      setNotice("New student registration code created. The previous code is no longer valid.");
    } catch (err) {
      setError(getApiError(err, "Unable to create registration code."));
    } finally {
      setGeneratingCode(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.17em] text-indigo-600">Operations overview</p><h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-slate-900">Admin dashboard</h1><p className="mt-2 text-sm text-slate-500">Manage requests, equipment, and access across your campus labs.</p></div><button onClick={loadData} className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50 sm:self-auto"><RefreshCw size={15} /> Refresh data</button></div>
      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {notice && <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><Check size={17} />{notice}</div>}

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Total bookings" value={loading ? "—" : bookings.length} detail="All submitted booking requests" icon={Activity} color="bg-indigo-50 text-indigo-700" />
        <Metric label="Active equipment" value={loading ? "—" : activeEquipment} detail={`${equipment.length} items in the catalog`} icon={Cpu} color="bg-cyan-50 text-cyan-700" />
        <Metric label="Pending requests" value={loading ? "—" : pending.length} detail={pending.length ? "Needs your review" : "All caught up"} icon={Clock3} color="bg-amber-50 text-amber-700" />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><UsersRound size={19} /></span><div><h2 className="font-display text-lg font-extrabold text-slate-900">Your students</h2><p className="text-sm text-slate-500">Only students registered with your code appear here.</p></div></div>
          <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
            {students.length ? students.map((student) => <div key={student.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><span className="truncate text-sm font-semibold text-slate-700">{student.name}</span><span className="truncate text-xs text-slate-500">{student.email}</span></div>) : <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No students registered with your code yet.</p>}
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-800">Student registration code</p><p className="mt-1 text-xs text-slate-500">Share this code with students. Creating a new one replaces the old code.</p></div><button disabled={generatingCode} onClick={generateRegistrationCode} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><span className="inline-flex items-center gap-1.5"><KeyRound size={14} />{generatingCode ? "Creating…" : "Generate code"}</span></button></div>
            {registrationCode && <p className="mt-3 select-all rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 font-mono text-sm font-bold tracking-wider text-indigo-800">{registrationCode}</p>}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><UserPlus size={19} /></span><div><h2 className="font-display text-lg font-extrabold text-slate-900">Administrators</h2><p className="text-sm text-slate-500">Administrators share equipment and manage separate student groups.</p></div></div>
          <form onSubmit={createAdmin} className="mt-4 grid gap-2 sm:grid-cols-2">
            <input required aria-label="Administrator name" placeholder="Full name" value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            <input required type="email" aria-label="Administrator email" placeholder="Email address" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
            <input required type="password" minLength={12} aria-label="Temporary administrator password" placeholder="Temporary password (12+ chars)" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400 sm:col-span-2" />
            <button disabled={savingAdmin} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60 sm:col-span-2">{savingAdmin ? "Creating…" : "Create administrator"}</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">Every administrator can create other administrator accounts. Share initial passwords securely.</p>
          <div className="mt-4 max-h-36 space-y-2 overflow-y-auto border-t border-slate-100 pt-4">
            {admins.map((admin) => <div key={admin.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold text-slate-700">{admin.name}</span><span className="truncate text-xs text-slate-500">{admin.email}</span></div>)}
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Usage analytics</p><h2 className="font-display mt-1 text-lg font-extrabold text-slate-900">Bookings per equipment</h2><p className="mt-1 text-sm text-slate-500">Booking request volume across the catalog.</p></div><div className="h-64">{counts.length ? <Bar data={chartData} options={chartOptions} /> : <div className="flex h-full items-center justify-center text-sm text-slate-400">Equipment analytics will appear here.</div>}</div></article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Catalog</p><h2 className="font-display mt-1 text-lg font-extrabold text-slate-900">Equipment management</h2><p className="mt-1 text-sm text-slate-500">Update availability or add a resource.</p></div><button onClick={() => setShowForm(!showForm)} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700"><CirclePlus size={15} /> Add</button></div>
          {showForm && <form onSubmit={createEquipment} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4"><input required placeholder="Equipment name" value={equipmentForm.name} onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" /><input placeholder="Category (optional)" value={equipmentForm.category} onChange={(e) => setEquipmentForm({ ...equipmentForm, category: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" /><input placeholder="Location (optional)" value={equipmentForm.location} onChange={(e) => setEquipmentForm({ ...equipmentForm, location: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" /><textarea placeholder="Short description (optional)" rows="2" value={equipmentForm.description} onChange={(e) => setEquipmentForm({ ...equipmentForm, description: e.target.value })} className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" /><button disabled={savingEquipment} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60">{savingEquipment ? "Adding…" : "Save equipment"}</button></form>}
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {equipment.map((item) => {
              const available = item.available !== false && item.isAvailable !== false;
              const editing = editingEquipmentId === item._id;
              return (
                <div key={item._id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${available ? "bg-indigo-50 text-indigo-600" : "bg-slate-100 text-slate-400"}`}><PackageCheck size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
                      <p className={`mt-0.5 text-[11px] font-semibold ${available ? "text-emerald-600" : "text-slate-400"}`}>{available ? "Available" : "Unavailable"}</p>
                    </div>
                    <button disabled={busyId === item._id} onClick={() => editing ? setEditingEquipmentId("") : startEditingEquipment(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      <span className="inline-flex items-center gap-1"><Pencil size={12} />{editing ? "Close" : "Edit"}</span>
                    </button>
                    <button disabled={busyId === item._id} onClick={() => toggleEquipment(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">{available ? "Disable" : "Enable"}</button>
                  </div>
                  {editing && (
                    <form onSubmit={(event) => saveEquipmentChanges(event, item._id)} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      <input required aria-label="Equipment name" value={editEquipmentForm.name} onChange={(event) => setEditEquipmentForm({ ...editEquipmentForm, name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                      <div className="grid grid-cols-2 gap-2">
                        <input required aria-label="Equipment category" value={editEquipmentForm.category} onChange={(event) => setEditEquipmentForm({ ...editEquipmentForm, category: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        <input required aria-label="Equipment location" value={editEquipmentForm.location} onChange={(event) => setEditEquipmentForm({ ...editEquipmentForm, location: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                      </div>
                      <textarea aria-label="Equipment description" rows="2" value={editEquipmentForm.description} onChange={(event) => setEditEquipmentForm({ ...editEquipmentForm, description: event.target.value })} className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                      <button disabled={busyId === item._id} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"><Save size={13} /> Save changes</button>
                    </form>
                  )}
                </div>
              );
            })}
            {!equipment.length && !loading && <p className="py-8 text-center text-sm text-slate-400">No equipment in the catalog.</p>}
          </div>
        </article>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6"><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Review queue</p><h2 className="font-display mt-1 text-lg font-extrabold text-slate-900">Student bookings</h2></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><Clock3 size={13} />{pending.length} pending</span></div>
        {loading ? <div className="px-6 py-12 text-center text-sm text-slate-400">Loading bookings…</div> : bookings.length === 0 ? <div className="px-6 py-14 text-center"><PackageCheck className="mx-auto text-slate-300" size={30} /><p className="mt-3 font-semibold text-slate-700">No booking requests yet</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-bold">Student</th><th className="px-5 py-3 font-bold">Equipment</th><th className="px-5 py-3 font-bold">Date &amp; slot</th><th className="px-5 py-3 font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Decision</th></tr></thead><tbody className="divide-y divide-slate-100">{bookings.map((booking) => { const start = new Date(booking.startAt || booking.date); const end = new Date(booking.endAt); const dateLabel = booking.date || booking.startAt ? new Date(`${String(booking.date || booking.startAt).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"; const startTime = booking.startTime || start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); const endTime = booking.endTime || end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }); return <tr key={booking._id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-bold text-slate-800">{booking.user?.name || booking.student?.name || "Student"}</p><p className="mt-0.5 text-xs text-slate-400">{booking.user?.email || booking.student?.email || ""}</p></td><td className="px-5 py-4 text-sm font-semibold text-slate-700">{nameOfEquipment(booking)}</td><td className="px-5 py-4"><p className="text-sm font-medium text-slate-700">{dateLabel}</p><p className="mt-0.5 text-xs text-slate-400">{startTime} – {endTime}</p></td><td className="px-5 py-4"><StatusBadge status={booking.status} /></td><td className="px-5 py-4 text-right">{booking.status?.toLowerCase() === "pending" ? <span className="inline-flex gap-2"><button disabled={busyId === booking._id} onClick={() => updateStatus(booking, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"><Check size={13} /> Approve</button><button disabled={busyId === booking._id} onClick={() => updateStatus(booking, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"><X size={13} /> Reject</button></span> : <span className="text-xs font-medium text-slate-400">Reviewed</span>}</td></tr>; })}</tbody></table></div>}
      </section>
      <footer className="py-8 text-center text-xs text-slate-400">LabVault · Campus equipment, coordinated.</footer>
    </main>
  );
}
