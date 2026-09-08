import { fieldClass } from "@/components/auth/ui";
import { INDIAN_STATES, INDIA_COUNTRY } from "@/lib/india";

export function AddressFields({
  defaultValues,
}: {
  defaultValues?: {
    name?: string;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    postalCode?: string;
    phone?: string | null;
  };
}) {
  return (
    <div className="grid gap-4">
      <input type="hidden" name="country" value={INDIA_COUNTRY} />
      <label className="block text-sm font-medium text-stone-700">
        Full name
        <input
          className={fieldClass}
          name="name"
          autoComplete="name"
          defaultValue={defaultValues?.name}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Address line 1
        <input
          className={fieldClass}
          name="line1"
          autoComplete="address-line1"
          defaultValue={defaultValues?.line1}
          required
        />
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Address line 2 (optional)
        <input
          className={fieldClass}
          name="line2"
          autoComplete="address-line2"
          defaultValue={defaultValues?.line2 ?? ""}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          City
          <input
            className={fieldClass}
            name="city"
            autoComplete="address-level2"
            defaultValue={defaultValues?.city}
            required
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          State / UT
          <select
            className={fieldClass}
            name="state"
            defaultValue={defaultValues?.state ?? ""}
            required
          >
            <option value="" disabled>
              Select
            </option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-stone-700">
          PIN code
          <input
            className={fieldClass}
            name="postalCode"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={defaultValues?.postalCode}
            pattern="[1-9][0-9]{5}"
            required
          />
        </label>
        <label className="block text-sm font-medium text-stone-700">
          Mobile (optional)
          <input
            className={fieldClass}
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={defaultValues?.phone ?? ""}
          />
        </label>
      </div>
      <p className="text-sm text-stone-600">Country: India only. We do not ship abroad.</p>
    </div>
  );
}
