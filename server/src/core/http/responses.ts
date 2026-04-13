/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
    });
}

/**
 * Create an error response with consistent format
 */
export function errorResponse(message: string, status = 500): Response {
    return jsonResponse({ error: message }, status);
}
