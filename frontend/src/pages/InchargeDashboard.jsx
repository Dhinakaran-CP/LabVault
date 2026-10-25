import { Check, PackageCheck, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import api, { getApiError } from "../lib/api";

const asArray = (data, key) => Array.isArray(data) ? data : data?.[key] || [];

export default function InchargeDashboard() {
  const { user } = useAuth();
  const [equipment, setEquipment] = useState([]);
  const [requests, setRequests] = useState([]);
  const [issued, setIssued] = useState([]);
  const [lab, setLab] = useState(null);
  const [form, setForm] = useState({ name: "", category: "", location: "", description: "", quantity: 1 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = async () => {
    setError("");
    try {
      const [equipmentResponse, bookingsResponse, issuedResponse, labsResponse] = await Promise.all([
        api.get("/equipment/mine"),
        api.get("/bookings?status=pending_lab"),
        api.get("/bookings?status=issued"),
        api.get("/labs")
      ]);
      setEquipment(asArray(equipmentResponse.data, "equipment"));
      setRequests(asArray(bookingsResponse.data, "bookings"));
      setIssued(asArray(issuedResponse.data, "bookings"));
      setLab(asArray(labsResponse.data, "labs").find((item) => item.inchargeId === user?.id) || null);
    } catch (err) {
      setError(getApiError(err, "We couldn't load the lab dashboard."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const addEquipment = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/equipment", {
        ...form,
        quantity: Number(form.quantity),
        category: form.category || "General",
        location: form.location || lab?.name || "Lab"
      });
      setForm({ name: "", category: "", location: "", description: "", quantity: 1 });
      setNotice("Equipment added to your lab.");
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to add equipment."));
    } finally {
      setSaving(false);
    }
  };

  const decide = async (booking, status) => {
    setBusyId(booking._id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/bookings/${booking._id}/lab-decision`, { status });
      setNotice(status === "approved" ? "Equipment allocated to the student." : "Request declined.");
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to decide this request."));
    } finally {
      setBusyId("");
    }
  };

  const markReturned = async (booking) => {
    setBusyId(booking._id);
    setError("");
    setNotice("");
    try {
      await api.patch(`/bookings/${booking._id}/return`);
      setNotice(`${booking.equipment?.name} marked as returned.`);
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to mark this equipment as returned."));
    } finally {
      setBusyId("");
    }
  };

  const updateQuantity = async (item, value) => {
    if (value === "") {
      setError("Quantity is required.");
      return;
    }
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError("Quantity must be a non-negative whole number.");
      return;
    }
    setBusyId(item._id);
    setError("");
    try {
      await api.patch(`/equipment/${item._id}`, { quantity });
      setNotice(`${item.name} stock updated.`);
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to update stock."));
    } finally {
      setBusyId("");
    }
  };

  const deleteEquipment = async (item) => {
    setBusyId(item._id);
    setError("");
    try {
      await api.delete(`/equipment/${item._id}`);
      setNotice(`${item.name} removed from the catalog.`);
      await loadData();
    } catch (err) {
      setError(getApiError(err, "Unable to delete equipment."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.17em] text-indigo-600">Lab operations</p>
          <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight text-slate-900">{lab?.departmentName} · {lab?.name || "Lab incharge dashboard"}</h1>
          <p className="mt-2 text-sm text-slate-500">Review mentor-approved requests and manage this lab's equipment and stock.</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 shadow-sm hover:bg-slate-50"><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>}
      {notice && <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><Check size={17} />{notice}</div>}

      <section className="mt-7 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-display text-lg font-extrabold text-slate-900">Add equipment</h2>
          <p className="mt-1 text-sm text-slate-500">New inventory is automatically assigned to your lab.</p>
          <form onSubmit={addEquipment} className="mt-4 space-y-3">
            <input required aria-label="Equipment name" placeholder="Equipment name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input aria-label="Category" placeholder="Category" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input aria-label="Location" placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <label className="block text-sm font-semibold text-slate-700">Units in lab<input required aria-label="Quantity" type="number" min="0" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
            <textarea aria-label="Description" placeholder="Description" rows="3" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <button disabled={saving || !lab} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} />{saving ? "Adding…" : "Add to lab inventory"}</button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-display text-lg font-extrabold text-slate-900">Requests awaiting stock decision</h2><p className="mt-1 text-sm text-slate-500">Mentor-approved requests for your lab.</p></div>
            <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{requests.length} pending</span>
          </div>
          {loading ? <p className="py-10 text-center text-sm text-slate-400">Loading requests…</p> : requests.length ? <div className="mt-4 space-y-3">
            {requests.map((booking) => <div key={booking._id} className="rounded-xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-bold text-slate-800">{booking.equipment?.name}</p><p className="mt-1 text-sm text-slate-600">{booking.student?.name} · {booking.student?.email}</p><p className="mt-1 text-xs text-slate-500">{booking.date} · {booking.startTime}–{booking.endTime}</p><p className="mt-2 text-xs text-slate-500">Requested: {booking.purpose}</p></div>
                <StatusBadge status={booking.status} />
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button disabled={busyId === booking._id} onClick={() => decide(booking, "rejected")} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"><X size={14} /> Decline</button>
                <button disabled={busyId === booking._id} onClick={() => decide(booking, "approved")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={14} /> Allocate unit</button>
              </div>
            </div>)}
          </div> : <p className="py-10 text-center text-sm text-slate-400">No mentor-approved requests are waiting.</p>}
        </article>
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-lg font-extrabold text-slate-900">Allocated equipment awaiting return</h2><p className="mt-1 text-sm text-slate-500">Confirm physical returns to release the unit for other requests.</p></div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{issued.length} issued</span>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-400">Loading allocations…</p> : issued.length ? <div className="mt-4 space-y-2">
          {issued.map((booking) => <div key={booking._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
            <div><p className="font-bold text-slate-800">{booking.equipment?.name} · {booking.student?.name}</p><p className="mt-1 text-xs text-slate-500">{booking.date} · {booking.startTime}–{booking.endTime}</p></div>
            <button disabled={busyId === booking._id} onClick={() => markReturned(booking)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"><Check size={14} /> Mark returned</button>
          </div>)}
        </div> : <p className="py-8 text-center text-sm text-slate-400">No allocated equipment is awaiting return.</p>}
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-display text-lg font-extrabold text-slate-900">Equipment and stock</h2>
        <p className="mt-1 text-sm text-slate-500">Update the quantity or delete equipment assigned to your lab.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {equipment.map((item) => <article key={item._id} className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-bold text-slate-800">{item.name}</p><p className="mt-1 text-xs text-slate-500">{item.category} · {item.location}</p></div><PackageCheck size={18} className="shrink-0 text-indigo-600" /></div>
            <div className="mt-3 flex items-end gap-2"><label className="flex-1 text-xs font-semibold text-slate-600">Units in lab<input aria-label={`${item.name} quantity`} type="number" min="0" step="1" defaultValue={item.quantity} onBlur={(event) => { if (event.target.value !== "" && Number(event.target.value) !== item.quantity) updateQuantity(item, event.target.value); }} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><button disabled={busyId === item._id} onClick={() => deleteEquipment(item)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 disabled:opacity-50"><Trash2 size={13} /> Delete</button></div>
          </article>)}
          {!loading && !equipment.length && <p className="py-8 text-sm text-slate-400">No equipment has been added to this lab yet.</p>}
        </div>
      </section>
      <footer className="py-8 text-center text-xs text-slate-400">LabVault · Campus equipment, coordinated.</footer>
    </main>
  );
}
