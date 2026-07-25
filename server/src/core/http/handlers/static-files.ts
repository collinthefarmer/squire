import { ImageResizeService } from "@services/image/image-resize-service";

const PUBLIC_DIR = "public";
const imageResizeService = new ImageResizeService();

/**
 * Handle static file requests under /public/.
 *
 * Supports:
 * - Image resize via ?w= and ?h= query parameters
 * - Range requests for audio/video seeking
 * - CORS headers for cross-origin access
 *
 * Returns null if the request path doesn't match /public/*.
 */
export async function handleStaticFile(
    req: Request,
    url: URL,
): Promise<Response | null> {
    if (!url.pathname.startsWith(`/${PUBLIC_DIR}/`)) {
        return null;
    }

    // Handle image resize requests
    if (url.pathname.startsWith(`/${PUBLIC_DIR}/images/`)) {
        const filename = url.pathname.replace(`/${PUBLIC_DIR}/images/`, "");

        const widthParam = url.searchParams.get("w");
        const heightParam = url.searchParams.get("h");
        const width = widthParam ? parseInt(widthParam, 10) : null;
        const height = heightParam ? parseInt(heightParam, 10) : null;

        if (width || height) {
            const resized = await imageResizeService.getResizedImage(
                filename,
                width,
                height,
            );

            if (!resized) {
                return new Response("Not Found", { status: 404 });
            }

            return new Response(resized.buffer, {
                headers: {
                    "Content-Type": resized.contentType,
                    "Cache-Control": "public, max-age=31536000",
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
    }

    // Serve original file
    const filePath = "." + url.pathname;
    const file = Bun.file(filePath);

    if (!(await file.exists())) {
        return new Response("Not Found", { status: 404 });
    }

    const fileSize = file.size;
    const rangeHeader = req.headers.get("Range");

    // Handle Range requests for seeking in audio/video
    if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (match) {
            const start = parseInt(match[1], 10);
            const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
            const chunkSize = end - start + 1;

            const slice = file.slice(start, end + 1);

            return new Response(slice, {
                status: 206,
                headers: {
                    "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                    "Accept-Ranges": "bytes",
                    "Content-Length": String(chunkSize),
                    "Content-Type": file.type,
                    "Access-Control-Allow-Origin": "*",
                },
            });
        }
    }

    // Regular request - return full file with Accept-Ranges header
    return new Response(file, {
        headers: {
            "Accept-Ranges": "bytes",
            "Content-Length": String(fileSize),
            "Content-Type": file.type,
            "Access-Control-Allow-Origin": "*",
        },
    });
}
