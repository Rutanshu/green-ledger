import { ROLE_LABEL, type Role } from "@/lib/auth/permissions";

export function Denied({ role }: { role: Role }) {
  return (
    <>
      <h1 className="text-xl font-semibold">Not available</h1>
      <p className="mt-3 max-w-md text-[13px] text-ink2">
        Your role ({ROLE_LABEL[role]}) doesn&apos;t have access to this screen. Sign in as Super Admin to see it.
      </p>
    </>
  );
}
