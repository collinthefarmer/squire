import { BehaviorSubject, map, distinctUntilChanged, type Observable } from "rxjs";
import { Logger } from "@utils/logger";

const DB_NAME = "squire-store";
const DB_VERSION = 1;
const STORE_NAME = "data";

/**
 * Local data store for master-specific persistent data.
 *
 * Stores DM-authored content and preferences (scene configs,
 * saved presets, default settings) in IndexedDB. NOT for transient
 * application state — that's managed by the server's event system.
 *
 * In-memory BehaviorSubject is the source of truth for the current
 * session. IndexedDB persists across reloads. Writes update memory
 * synchronously and persist to IndexedDB in the background.
 *
 * @example
 * ```typescript
 * const store = ServiceRegistry.get(TOKENS.LocalStore);
 *
 * // Write
 * await store.set("settings.micDeviceId", "abc123");
 *
 * // Reactive read
 * store.get$<string>("settings.micDeviceId").subscribe(id => ...);
 *
 * // Sync read
 * const id = store.get<string>("settings.micDeviceId");
 * ```
 */
export class LocalStore {
    private logger = new Logger("LocalStore");
    private store$ = new BehaviorSubject<Map<string, unknown>>(new Map());
    private ready$ = new BehaviorSubject<boolean>(false);
    private db: IDBDatabase | null = null;

    constructor() {
        this.init();
    }

    // -- Read --

    get$<T>(key: string): Observable<T | undefined> {
        return this.store$.pipe(
            map((store) => store.get(key) as T | undefined),
            distinctUntilChanged(),
        );
    }

    get<T>(key: string): T | undefined {
        return this.store$.value.get(key) as T | undefined;
    }

    keys(): string[] {
        return Array.from(this.store$.value.keys());
    }

    isReady$(): Observable<boolean> {
        return this.ready$.asObservable();
    }

    isReady(): boolean {
        return this.ready$.value;
    }

    // -- Write --

    async set<T>(key: string, value: T): Promise<void> {
        const updated = new Map(this.store$.value);
        updated.set(key, value);
        this.store$.next(updated);

        await this.dbPut(key, value);
    }

    async remove(key: string): Promise<void> {
        const updated = new Map(this.store$.value);
        updated.delete(key);
        this.store$.next(updated);

        await this.dbDelete(key);
    }

    async clear(): Promise<void> {
        this.store$.next(new Map());
        await this.dbClear();
    }

    // -- Initialization --

    private async init(): Promise<void> {
        try {
            this.db = await this.openDb();
            const entries = await this.dbGetAll();
            this.store$.next(entries);
            this.logger.info("Store loaded", { keys: entries.size });
        } catch (error) {
            this.logger.warn("IndexedDB unavailable, using in-memory only", {
                error,
            });
        }

        this.ready$.next(true);
    }

    // -- IndexedDB operations --

    private openDb(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private async dbGetAll(): Promise<Map<string, unknown>> {
        if (!this.db) {
            return new Map();
        }

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();
            const entries = new Map<string, unknown>();

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    entries.set(cursor.key as string, cursor.value);
                    cursor.continue();
                } else {
                    resolve(entries);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    private async dbPut(key: string, value: unknown): Promise<void> {
        if (!this.db) {
            return;
        }

        try {
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.put(value, key);

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            this.logger.error("Failed to persist key", { key, error });
        }
    }

    private async dbDelete(key: string): Promise<void> {
        if (!this.db) {
            return;
        }

        try {
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.delete(key);

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            this.logger.error("Failed to delete key", { key, error });
        }
    }

    private async dbClear(): Promise<void> {
        if (!this.db) {
            return;
        }

        try {
            const tx = this.db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.clear();

            await new Promise<void>((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (error) {
            this.logger.error("Failed to clear store", { error });
        }
    }
}
