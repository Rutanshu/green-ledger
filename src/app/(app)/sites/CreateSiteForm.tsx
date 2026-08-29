"use client";

import { useState } from "react";
import { CreateSiteFields } from "./CreateSiteFields";

interface SiteTypeOption {
  code: string;
  label: string;
}

export function CreateSiteForm({ siteTypes }: { siteTypes: SiteTypeOption[] }) {
  const [open, setOpen] = useState(false);
  // Remounting CreateSiteFields on "Add another" gives it a fresh
  // useActionState — there's no way to reset that hook's state from
  // outside except by remounting the component that owns it.
  const [formKey, setFormKey] = useState(0);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg bg-accent px-4 py-2 text-[13.5px] font-semibold text-white">
        + Add facility
      </button>
    );
  }

  return (
    <CreateSiteFields
      key={formKey}
      siteTypes={siteTypes}
      onCancel={() => setOpen(false)}
      onAddAnother={() => setFormKey((k) => k + 1)}
    />
  );
}
