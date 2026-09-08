import { FLAG_DEMO_MODE, FLAG_LABELS } from "@/lib/flags";
import { setFeatureFlag } from "@/server/actions/admin";
import { buttonClass, secondaryButtonClass } from "@/components/auth/ui";

export function DemoModeCard({
  enabled,
  canEdit,
  next = "/admin",
}: {
  enabled: boolean;
  canEdit: boolean;
  next?: "/admin" | "/admin/flags";
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-900">
        Walkthrough
      </p>
      <h2 className="mt-1 text-lg font-semibold text-stone-900">Demo mode</h2>
      <p className="mt-2 text-sm text-stone-700">
        {FLAG_LABELS[FLAG_DEMO_MODE]} Currently{" "}
        <span className="font-medium">{enabled ? "on" : "off"}</span>.
      </p>
      {canEdit ? (
        <form action={setFeatureFlag} className="mt-4">
          <input type="hidden" name="key" value={FLAG_DEMO_MODE} />
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <input type="hidden" name="next" value={next} />
          <button
            className={`${enabled ? secondaryButtonClass : buttonClass} w-auto`}
            type="submit"
          >
            {enabled ? "Turn off demo mode" : "Turn on demo mode"}
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-stone-600">Only admins can change this.</p>
      )}
    </section>
  );
}
