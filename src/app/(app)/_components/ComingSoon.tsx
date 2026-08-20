export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-3 max-w-lg text-[13px] text-ink2">{blurb}</p>
      <p className="mt-6 rounded-[11px] border border-dashed border-border bg-surface p-4 text-[13px] text-muted">
        Not built yet. The data model and calculation engine exist and are tested — this screen doesn't.
      </p>
    </>
  );
}
