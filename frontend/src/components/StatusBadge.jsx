const styles = {
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/10",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/10"
};

export default function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${styles[normalized] || styles.pending}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{normalized}</span>;
}
