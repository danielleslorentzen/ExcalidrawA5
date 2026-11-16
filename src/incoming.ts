/**
 * Files handed to the installed app from outside: the Android share sheet
 * (manifest share_target, parked in a cache by public/share-target.js) and
 * desktop "Open with" (manifest file_handlers, delivered through launchQueue).
 */

const SHARE_CACHE = "a5-shared-files";

/** Files shared via the share sheet, if this launch came from one. Removes them once read. */
export async function takeSharedFiles(): Promise<File[] | "error" | null> {
  const url = new URL(location.href);
  const shared = url.searchParams.get("shared");
  if (shared === null) return null;
  url.searchParams.delete("shared");
  history.replaceState(history.state, "", url.href);
  if (shared === "error" || !("caches" in window)) return "error";
  const cache = await caches.open(SHARE_CACHE);
  const files: File[] = [];
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (res) {
      const name = decodeURIComponent(res.headers.get("x-file-name") ?? "shared-file");
      files.push(new File([await res.blob()], name, { type: res.headers.get("content-type") ?? "" }));
    }
    await cache.delete(req);
  }
  return files;
}

interface LaunchParams {
  files: readonly FileSystemFileHandle[];
}
interface LaunchQueue {
  setConsumer(consumer: (params: LaunchParams) => void): void;
}

/** Calls onFiles for every file opened with the app ("Open with" on desktop). */
export function onLaunchFiles(onFiles: (files: File[]) => void) {
  const queue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
  queue?.setConsumer(async ({ files }) => {
    if (!files.length) return;
    onFiles(await Promise.all(files.map((h) => h.getFile())));
  });
}
