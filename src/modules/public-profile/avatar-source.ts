export function publicStoragePattern(base: string | undefined) {
  if (!base) return undefined;
  try {
    const url = new URL(base);
    if (url.protocol !== "https:" || url.port) return undefined;
    return { protocol: "https" as const, hostname: url.hostname, port: "", pathname: "/storage/v1/object/public/**", search: "" };
  } catch {
    return undefined;
  }
}

export function profileAvatarSource(value: string | null, base: string | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const storage = publicStoragePattern(base);
    const optimized = Boolean(storage && url.hostname === storage.hostname && !url.port && !url.search
      && url.pathname.startsWith("/storage/v1/object/public/"));
    return { url: url.href, optimized };
  } catch {
    return null;
  }
}
