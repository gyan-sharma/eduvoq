import { fieldClass } from "@/components/auth/ui";
import {
  BOARD_LABELS,
  BOARD_VALUES,
  CLASS_LEVELS,
  classLevelLabel,
} from "@/lib/resource-meta";

export function ResourceFilters({
  action,
  board,
  classLevel,
  subject,
}: {
  action: string;
  board?: string;
  classLevel?: string;
  subject?: string;
}) {
  return (
    <form
      method="get"
      action={action}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4"
    >
      <label className="block text-sm font-medium text-stone-700">
        Board
        <select className={fieldClass} name="board" defaultValue={board ?? ""}>
          <option value="">All boards</option>
          {BOARD_VALUES.map((value) => (
            <option key={value} value={value}>
              {BOARD_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium text-stone-700">
        Class
        <select
          className={fieldClass}
          name="classLevel"
          defaultValue={classLevel ?? ""}
        >
          <option value="">All classes</option>
          {CLASS_LEVELS.map((level) => (
            <option key={level} value={level}>
              {classLevelLabel(level)}
            </option>
          ))}
        </select>
      </label>
      <label className="block min-w-40 flex-1 text-sm font-medium text-stone-700">
        Subject
        <input
          className={fieldClass}
          type="search"
          name="subject"
          defaultValue={subject ?? ""}
          placeholder="e.g. Mathematics"
        />
      </label>
      <button
        type="submit"
        className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Filter
      </button>
    </form>
  );
}
