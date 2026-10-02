import { get, set, del } from "idb-keyval";
import type { DB } from "../domain/types";
import { DB_VERSION, createSeed } from "./seed";

/**
 * Data access boundary. The demo stores everything on this device; a server-backed
 * implementation (REST/GraphQL) can replace LocalRepository without touching the UI,
 * because screens only talk to the store, and the store only talks to Repository.
 */
export interface Repository {
  load(): DB;
  save(db: DB): void;
  reset(): DB;
}

const KEY = "beautigo.db";

/** In-memory fallback when storage is unavailable (private mode, blocked storage). */
let memory: DB | null = null;

export class LocalRepository implements Repository {
  load(): DB {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw) as DB;
        if (db.version === DB_VERSION) return db;
      }
    } catch {
      if (memory) return memory;
    }
    return this.reset();
  }
  save(db: DB) {
    memory = db;
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      /* quota or blocked storage: keep the in-memory copy */
    }
  }
  reset(): DB {
    const db = createSeed();
    this.save(db);
    return db;
  }
}

/** Uploaded media blobs live in IndexedDB; posts reference them as "idb:<key>". */
export const mediaStore = {
  async put(file: Blob) {
    const key = `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    try {
      await set(key, file);
      return `idb:${key}`;
    } catch {
      // storage blocked: fall back to an object URL for this session only
      return URL.createObjectURL(file);
    }
  },
  async url(src: string) {
    if (!src.startsWith("idb:")) return src;
    const blob = await get<Blob>(src.slice(4)).catch(() => undefined);
    return blob ? URL.createObjectURL(blob) : null;
  },
  async remove(src: string) {
    if (src.startsWith("idb:")) await del(src.slice(4)).catch(() => {});
  },
};

export const repository: Repository = new LocalRepository();
