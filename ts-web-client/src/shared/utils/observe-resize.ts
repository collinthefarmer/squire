import { Observable } from "rxjs";

/**
 * Create an Observable from a ResizeObserver on a single element.
 * Emits resize entries on each observation. Automatically disconnects
 * the observer when unsubscribed.
 */
export function observeResize(
    element: Element,
): Observable<ResizeObserverEntry[]> {
    return new Observable((subscriber) => {
        const observer = new ResizeObserver((entries) => {
            subscriber.next(entries);
        });

        observer.observe(element);

        return () => observer.disconnect();
    });
}
