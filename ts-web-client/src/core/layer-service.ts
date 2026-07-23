/**
 * LayerService — reactive per-layer selection and URL enrichment.
 *
 * Turns the store's flat `layers$` map into what a renderer actually
 * needs: the set of live layer ids, and a stable per-id stream of
 * render-ready `LayerView`s. It holds the `ImageService` so that the
 * `imageRef → imageUrl` resolution happens here, once, and never has
 * to be threaded through the display component tree.
 *
 * The service produces DATA — selected state plus a resolved URL.
 * CSS derivation (filters, transforms, blend) stays in the view.
 */

import type { Observable } from "rxjs";
import { distinctUntilChanged, map, shareReplay } from "rxjs/operators";

import type { AppStore } from "@core/store";
import type { ImageService } from "@core/image-service";
import type { ImageLayerState, LayerId } from "@types";

/**
 * Render-ready projection of a layer: the domain state augmented
 * with a resolved image URL. The domain `ImageLayerState` is left
 * untouched — the URL rides this boundary type, not the state.
 */
export type LayerView = ImageLayerState & { imageUrl: string | null };

/** The one capability LayerService needs from the image layer — the
 * asset resolver. Narrowed so the service depends on the capability,
 * not the concrete (DOM-adjacent) `ImageService`. */
type ImageUrlResolver = Pick<ImageService, "resolveUrl">;

export class LayerService {
    private readonly cache = new Map<LayerId, Observable<LayerView | undefined>>();

    readonly layerIds$: Observable<LayerId[]>;

    constructor(
        private readonly store: AppStore,
        private readonly imageService: ImageUrlResolver,
    ) {
        this.layerIds$ = this.store.layers$.pipe(
            map((layers) => [...layers.keys()]),
            distinctUntilChanged(sameIds),
            shareReplay(1),
        );
    }

    /**
     * Per-layer stream of the render-ready view. Memoized so a given
     * id always yields the same Observable instance — the consuming
     * component guards on that identity to avoid re-subscribing.
     *
     * Dedup runs on the raw domain object BEFORE enrichment: the
     * reducers preserve object identity for untouched layers, so a
     * change to a different layer leaves this one's reference stable
     * and `distinctUntilChanged` suppresses it before the allocating
     * spread ever runs. Each view thus re-emits only on its own change.
     */
    layer$(id: LayerId): Observable<LayerView | undefined> {
        const cached = this.cache.get(id);
        if (cached) return cached;

        const view$ = this.store.layers$.pipe(
            map((layers) => layers.get(id)),
            distinctUntilChanged(),
            map((layer) => this.toView(layer)),
            shareReplay(1),
        );

        this.cache.set(id, view$);
        return view$;
    }

    private toView(layer: ImageLayerState | undefined): LayerView | undefined {
        if (!layer) return undefined;

        const imageUrl = layer.imageRef
            ? this.imageService.resolveUrl(layer.imageRef)
            : null;

        return { ...layer, imageUrl };
    }
}

function sameIds(a: LayerId[], b: LayerId[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
}
