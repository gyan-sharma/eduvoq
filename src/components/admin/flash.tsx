export function AdminFlash({
  ok,
  error,
}: {
  ok?: string;
  error?: string;
}) {
  if (error) {
    return (
      <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
        {error}
      </p>
    );
  }
  if (ok) {
    return (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        {ok}
      </p>
    );
  }
  return null;
}
