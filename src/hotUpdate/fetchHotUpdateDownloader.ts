import { HotUpdateDownloader, HotUpdateManifest } from './hotUpdateTypes';

/** Plain `fetch`-backed downloader — hits ordinary HTTPS URLs, no native code involved. */
export class FetchHotUpdateDownloader implements HotUpdateDownloader {
  async fetchManifest(url: string): Promise<HotUpdateManifest> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`manifest request failed: ${res.status}`);
    return (await res.json()) as HotUpdateManifest;
  }

  async fetchFile(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`file request failed: ${res.status} ${url}`);
    return res.arrayBuffer();
  }
}
