/** A titled card section — the building block of /insights and /scoring. */
export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="border rounded-xl bg-card p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
