type ClassNameValue = string | false | null | undefined;
type QueryValue = string | null | undefined;

export function cn(...values: ClassNameValue[]) {
  return values.filter(Boolean).join(" ");
}

export function buildPathWithQuery(
  path: string,
  currentQuery: Record<string, string>,
  overrides: Record<string, QueryValue> = {},
) {
  const params = new URLSearchParams(currentQuery);

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();

  return query ? `${path}?${query}` : path;
}
