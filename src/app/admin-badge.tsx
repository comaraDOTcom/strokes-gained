/** Marks a page or section only the admin can see, so it's never mistaken for something players see. */
export function AdminBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Only you, the admin, can see this"
      className={`inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-accent ${className}`}
    >
      Admin only
    </span>
  );
}
