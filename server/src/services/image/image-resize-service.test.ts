import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { ImageResizeService } from "./image-resize-service";
import { existsSync, mkdirSync } from "fs";

// Store originals so we can restore after each test
const originalBunFile = Bun.file;
const originalBunWrite = Bun.write;

// Shape of the minimal Bun.file stand-in these tests hand back. Annotating the
// mock factories with this gives inference an anchor, so `exists` no longer
// collapses into TS7023 circular-return-type territory.
type MockBunFile = {
    exists: () => Promise<boolean>;
    arrayBuffer?: () => Promise<ArrayBufferLike>;
};

// Mock imgkit resize
mock.module("imgkit", () => ({
    resize: mock(async (_buf: Buffer, _opts: Record<string, unknown>) => {
        return Buffer.from("fake-resized-image-data");
    }),
}));

describe("ImageResizeService", () => {
    let service: ImageResizeService;

    beforeEach(() => {
        // Ensure cache dir exists so constructor doesn't fail
        if (!existsSync("public/.thumbs")) {
            mkdirSync("public/.thumbs", { recursive: true });
        }
        service = new ImageResizeService();
    });

    afterEach(() => {
        // Restore Bun globals
        Object.defineProperty(Bun, "file", { value: originalBunFile, writable: true });
        Object.defineProperty(Bun, "write", { value: originalBunWrite, writable: true });
    });

    describe("dimension validation", () => {
        test("should return null when both width and height are null", async () => {
            const result = await service.getResizedImage("test.png", null, null);
            expect(result).toBeNull();
        });

        test("should return null when width is below minimum (16)", async () => {
            const result = await service.getResizedImage("test.png", 15, null);
            expect(result).toBeNull();
        });

        test("should return null when width exceeds maximum (2048)", async () => {
            const result = await service.getResizedImage("test.png", 2049, null);
            expect(result).toBeNull();
        });

        test("should return null when height is below minimum (16)", async () => {
            const result = await service.getResizedImage("test.png", null, 15);
            expect(result).toBeNull();
        });

        test("should return null when height exceeds maximum (2048)", async () => {
            const result = await service.getResizedImage("test.png", null, 2049);
            expect(result).toBeNull();
        });

        test("should accept width at lower boundary (16)", async () => {
            // Mock: no cache, source exists
            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: mock(async () => {}),
                writable: true,
            });

            const result = await service.getResizedImage("test.png", 16, null);
            expect(result).not.toBeNull();
            expect(result!.contentType).toBe("image/webp");
        });

        test("should accept width at upper boundary (2048)", async () => {
            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: mock(async () => {}),
                writable: true,
            });

            const result = await service.getResizedImage("test.png", 2048, null);
            expect(result).not.toBeNull();
        });

        test("should accept height at lower boundary (16)", async () => {
            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: mock(async () => {}),
                writable: true,
            });

            const result = await service.getResizedImage("test.png", null, 16);
            expect(result).not.toBeNull();
        });

        test("should accept height at upper boundary (2048)", async () => {
            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: mock(async () => {}),
                writable: true,
            });

            const result = await service.getResizedImage("test.png", null, 2048);
            expect(result).not.toBeNull();
        });
    });

    describe("cache hit", () => {
        test("should return cached image when cache file exists", async () => {
            const cachedData = new Uint8Array([1, 2, 3, 4]);

            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return {
                            exists: async () => true,
                            arrayBuffer: async () => cachedData.buffer,
                        };
                    }
                    return { exists: async () => true };
                }),
                writable: true,
            });

            const result = await service.getResizedImage("photo.jpg", 200, null);
            expect(result).not.toBeNull();
            expect(result!.contentType).toBe("image/webp");
            expect(result!.buffer.length).toBe(4);
        });
    });

    describe("cache miss", () => {
        test("should generate and cache resized image when no cache exists", async () => {
            const writeMock = mock(async () => {});

            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(16),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: writeMock,
                writable: true,
            });

            const result = await service.getResizedImage("photo.jpg", 300, 200);

            expect(result).not.toBeNull();
            expect(result!.contentType).toBe("image/webp");
            expect(writeMock).toHaveBeenCalledTimes(1);
        });
    });

    describe("source file existence", () => {
        test("should return null when source file does not exist", async () => {
            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    // Source file does not exist
                    return { exists: async () => false };
                }),
                writable: true,
            });

            const result = await service.getResizedImage("nonexistent.png", 100, null);
            expect(result).toBeNull();
        });
    });

    describe("cache key generation", () => {
        test("should use width x height format for cache key with both dimensions", async () => {
            const writeMock = mock(async () => {});
            const filePaths: string[] = [];

            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    filePaths.push(path);
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: writeMock,
                writable: true,
            });

            await service.getResizedImage("image.png", 400, 300);

            // The cache path should contain the cache key 400x300
            const cacheLookup = filePaths.find((p) => p.includes(".thumbs"));
            expect(cacheLookup).toContain("400x300");
        });

        test("should use 0 for null dimensions in cache key", async () => {
            const filePaths: string[] = [];

            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    filePaths.push(path);
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: mock(async () => {}),
                writable: true,
            });

            await service.getResizedImage("image.png", 200, null);

            const cacheLookup = filePaths.find((p) => p.includes(".thumbs"));
            expect(cacheLookup).toContain("200x0");
        });

        test("should strip file extension and use .webp for cached files", async () => {
            const writtenPaths: string[] = [];

            Object.defineProperty(Bun, "file", {
                value: mock((path: string): MockBunFile => {
                    if (path.includes(".thumbs")) {
                        return { exists: async () => false };
                    }
                    return {
                        exists: async () => true,
                        arrayBuffer: async () => new ArrayBuffer(8),
                    };
                }),
                writable: true,
            });
            Object.defineProperty(Bun, "write", {
                value: mock(async (path: string) => {
                    writtenPaths.push(path);
                }),
                writable: true,
            });

            await service.getResizedImage("photo.jpg", 100, null);

            expect(writtenPaths).toHaveLength(1);
            expect(writtenPaths[0]).toContain("photo.webp");
            expect(writtenPaths[0]).not.toContain(".jpg");
        });
    });
});
