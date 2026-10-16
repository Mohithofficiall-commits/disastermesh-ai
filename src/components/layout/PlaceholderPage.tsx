export function PlaceholderPage({
  title,
  purpose,
}: {
  title: string;
  purpose: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-wide text-teal">Placeholder · Phase 0</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <section className="rounded-2xl border border-sand bg-panel p-5">
        <p className="text-sm leading-relaxed text-slate-forest">{purpose}</p>
        <p className="mt-3 text-sm text-slate-muted">
          This screen does not load, store, or synchronize records. Shared TypeScript models exist so a later phase can fill this page without changing the shell.
        </p>
      </section>
    </div>
  );
}
