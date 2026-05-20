import { EffectsRack } from "@master/components/audio/effects-rack";
import { createMasterServices, registerMasterComponents } from "./setup";

/**
 * Initialize master client
 */
function init(): void {
    const { connection, assetService, contextMenuService } = createMasterServices();
    registerMasterComponents();

    // Mount context menu and effects rack on document.body (outside Shadow DOM)
    document.body.appendChild(document.createElement("context-menu"));

    const effectsRack = document.createElement(
        "effects-rack",
    ) as InstanceType<typeof EffectsRack>;
    document.body.appendChild(effectsRack);

    document.addEventListener("fx-rack-open", (e) => {
        const detail = (e as CustomEvent).detail as {
            channel: string;
            chainId: string;
            x: number;
            y: number;
        };
        effectsRack.show(detail.x, detail.y, detail.channel, detail.chainId);
    });

    // Intercept right-clicks and show custom context menu
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        const path = e.composedPath();
        const items = contextMenuService.collectItems(
            e.target as EventTarget,
            path as EventTarget[],
        );
        if (items.length > 0) {
            contextMenuService.show(e.clientX, e.clientY, items);
        } else {
            contextMenuService.hide();
        }
    });

    // Fetch assets before connecting so image dimensions are
    // available when the server replays image events on connect.
    assetService.refreshAssets().then(() => {
        connection.connect();
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
