import { Injectable } from "@nestjs/common";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

@Injectable()
export class AppCacheService {
  private readonly entries = new Map<string, CacheEntry<unknown>>();

  async getOrSet<T>(key: string, ttlMs: number, factory: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = this.entries.get(key) as CacheEntry<T> | undefined;

    if (entry && entry.expiresAt > now) {
      return entry.value;
    }

    const value = await factory();
    this.entries.set(key, { expiresAt: now + ttlMs, value });
    return value;
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  deleteByPrefix(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  clear() {
    this.entries.clear();
  }
}
