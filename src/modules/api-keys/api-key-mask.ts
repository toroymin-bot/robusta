const PREFIX_VISIBLE = 7;
const SUFFIX_VISIBLE = 4;

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length === 0) return "";
  if (trimmed.length <= PREFIX_VISIBLE + SUFFIX_VISIBLE) {
    return trimmed;
  }
  const head = trimmed.slice(0, PREFIX_VISIBLE);
  const tail = trimmed.slice(-SUFFIX_VISIBLE);
  return `${head}...${tail}`;
}
