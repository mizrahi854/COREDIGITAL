/** Web Share when available, otherwise copy the link. Returns what happened so the UI can say so. */
export async function shareLink(title: string, path: string): Promise<"shared" | "copied" | "failed" | "dismissed"> {
  const url = `${location.origin}${location.pathname}#${path}`;
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "dismissed";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
