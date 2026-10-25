const styles = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/10",
  pending_mentor: "bg-amber-50 text-amber-700 ring-amber-600/10",
  pending_lab: "bg-cyan-50 text-cyan-700 ring-cyan-600/10",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/10",
  returned: "bg-indigo-50 text-indigo-700 ring-indigo-600/10",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/10"
};

export default function StatusBadge({ status }) {
  const normalized = String(status || "pending_mentor").toLowerCase();
  const label = normalized === "pending_mentor" ? "Mentor review"
    : normalized === "pending_lab" ? "Incharge review"
      : normalized;
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${styles[normalized] || styles.pending}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{label}</span>;
}
