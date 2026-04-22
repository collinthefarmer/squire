import { BehaviorSubject, type Observable } from "rxjs";

export interface MenuItem {
    label: string;
    action: () => void;
    icon?: string;
    suffix?: string;
    danger?: boolean;
    disabled?: boolean;
    separator?: boolean;
}

export type MenuProvider = (
    target: EventTarget,
    path: EventTarget[],
) => MenuItem[] | null;

export interface MenuState {
    visible: boolean;
    x: number;
    y: number;
    items: MenuItem[];
}

const HIDDEN: MenuState = { visible: false, x: 0, y: 0, items: [] };

/**
 * Context menu service
 *
 * Manages a registry of menu item providers and the menu's
 * visibility state. Components register providers that inspect
 * the right-click target and return contextual actions.
 */
export class ContextMenuService {
    private providers: MenuProvider[] = [];
    private state$ = new BehaviorSubject<MenuState>(HIDDEN);

    getState$(): Observable<MenuState> {
        return this.state$.asObservable();
    }

    getState(): MenuState {
        return this.state$.value;
    }

    registerProvider(provider: MenuProvider): void {
        this.providers.push(provider);
    }

    unregisterProvider(provider: MenuProvider): void {
        this.providers = this.providers.filter((p) => p !== provider);
    }

    /**
     * Collect menu items from all providers for a given target.
     * Providers that return null are skipped. Groups are separated
     * by setting `separator: true` on the first item of each group
     * after the first.
     */
    collectItems(target: EventTarget, path: EventTarget[]): MenuItem[] {
        const allItems: MenuItem[] = [];

        for (const provider of this.providers) {
            const items = provider(target, path);
            if (!items || items.length === 0) {
                continue;
            }

            if (allItems.length > 0) {
                items[0] = { ...items[0]!, separator: true };
            }

            allItems.push(...items);
        }

        return allItems;
    }

    show(x: number, y: number, items: MenuItem[]): void {
        this.state$.next({ visible: true, x, y, items });
    }

    hide(): void {
        if (this.state$.value.visible) {
            this.state$.next(HIDDEN);
        }
    }
}
