/** The only place in the app that calls fetch().
 *
 * Artifact URLs come from the manifest, which is compiled into the bundle
 * rather than fetched: a data refresh changes the manifest, which changes the
 * bundle hash, so the page and its data can never disagree.
 */
import manifestJson from "./manifest.json";
import type {
  AdvisoryIndex,
  FigureQ1,
  FigureQ2,
  FigureQ3,
  FigureQ4,
  FigureQ5,
  Manifest,
  Methods,
  PackageDetail,
} from "./types";

export const manifest = manifestJson as unknown as Manifest;

const cache = new Map<string, Promise<unknown>>();

async function fetchJson<T>(url: string): Promise<T> {
  const existing = cache.get(url);
  if (existing) return existing as Promise<T>;

  const request = fetch(url, { headers: { accept: "application/json" } }).then(
    (response) => {
      if (!response.ok) {
        throw new Response(`Could not load ${url}`, { status: response.status });
      }
      return response.json() as Promise<T>;
    },
  );
  // A failed request must not poison the cache: a reader who retries after
  // losing connectivity should get a fresh attempt, not the stored rejection.
  request.catch(() => cache.delete(url));
  cache.set(url, request);
  return request;
}

export const loadAdvisories = () =>
  fetchJson<AdvisoryIndex>(manifest.files.advisories);

export const loadMethods = () => fetchJson<Methods>(manifest.files.methods);

type FigureMap = {
  q1: FigureQ1;
  q2: FigureQ2;
  q3: FigureQ3;
  q4: FigureQ4;
  q5: FigureQ5;
};

export const loadFigure = <K extends keyof FigureMap>(key: K) =>
  fetchJson<FigureMap[K]>(manifest.files.figures[key]);

export function loadPackage(name: string): Promise<PackageDetail> {
  const url = manifest.files.detail[name];
  if (!url) {
    throw new Response(`No package named ${name}`, { status: 404 });
  }
  return fetchJson<PackageDetail>(url);
}

export const packageNames = Object.keys(manifest.files.detail).sort();
