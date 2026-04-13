/**
 * Route handler function type
 */
export type RouteHandler = (
    req: Request,
    params: RouteParams
) => Response | Promise<Response>;

/**
 * Route parameters extracted from path
 */
export interface RouteParams {
    [key: string]: string;
}

/**
 * Route match result
 */
export interface RouteMatch {
    handler: RouteHandler;
    params: RouteParams;
}

/**
 * Lightweight HTTP router with path parameter extraction
 *
 * Supports method-specific routing and simple path patterns with :param syntax
 */
export class Router {
    private routes: Map<string, Map<string, RouteHandler>> = new Map();

    /**
     * Register a GET route
     */
    get(path: string, handler: RouteHandler): void {
        this.registerRoute("GET", path, handler);
    }

    /**
     * Register a POST route
     */
    post(path: string, handler: RouteHandler): void {
        this.registerRoute("POST", path, handler);
    }

    /**
     * Register a DELETE route
     */
    delete(path: string, handler: RouteHandler): void {
        this.registerRoute("DELETE", path, handler);
    }

    /**
     * Register a route for a specific HTTP method
     */
    private registerRoute(
        method: string,
        path: string,
        handler: RouteHandler
    ): void {
        if (!this.routes.has(method)) {
            this.routes.set(method, new Map());
        }

        this.routes.get(method)!.set(path, handler);
    }

    /**
     * Match a request to a registered route
     *
     * Returns null if no match found
     */
    match(method: string, pathname: string): RouteMatch | null {
        const methodRoutes = this.routes.get(method);
        if (!methodRoutes) {
            return null;
        }

        // Try exact match first
        const exactHandler = methodRoutes.get(pathname);
        if (exactHandler) {
            return { handler: exactHandler, params: {} };
        }

        // Try pattern match
        for (const [pattern, handler] of methodRoutes.entries()) {
            const params = this.matchPattern(pattern, pathname);
            if (params !== null) {
                return { handler, params };
            }
        }

        return null;
    }

    /**
     * Match a path pattern against a pathname
     *
     * Returns extracted params or null if no match
     */
    private matchPattern(pattern: string, pathname: string): RouteParams | null {
        const patternParts = pattern.split("/").filter(Boolean);
        const pathnameParts = pathname.split("/").filter(Boolean);

        // Must have same number of segments
        if (patternParts.length !== pathnameParts.length) {
            return null;
        }

        const params: RouteParams = {};

        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathnamePart = pathnameParts[i];

            // Parameter segment (starts with :)
            if (patternPart.startsWith(":")) {
                const paramName = patternPart.slice(1);
                params[paramName] = decodeURIComponent(pathnamePart);
            }
            // Literal segment must match exactly
            else if (patternPart !== pathnamePart) {
                return null;
            }
        }

        return params;
    }
}
