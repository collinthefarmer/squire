/**
 * Master-local design / interface settings.
 *
 * A small reactive holder (BehaviorSubjects, in the AppStore idiom) for
 * preferences that shape the *editing surface* rather than the game
 * state — so, unlike AppStore, nothing here is dispatched to the server
 * or ever seen by players. The settings panel writes; the workspace and
 * the layer handles read.
 *
 * Values start from the constants that used to be compile-time fixed, so
 * turning the panel's controls live is a matter of calling the setters —
 * every reader already sources its value here.
 */

import { BehaviorSubject, type Observable } from "rxjs";
import {
    GRID,
    ROTATION_SNAP_DEGREES,
    ROTATION_SNAP_MIN,
    ROTATION_SNAP_MAX,
} from "@constants/grid";

export class SettingsService {
    private readonly _snapEnabled$ = new BehaviorSubject<boolean>(true);
    private readonly _gridSize$ = new BehaviorSubject<number>(GRID.SIZE);
    private readonly _rotationSnap$ = new BehaviorSubject<number>(ROTATION_SNAP_DEGREES);

    readonly snapEnabled$: Observable<boolean> = this._snapEnabled$.asObservable();
    readonly gridSize$: Observable<number> = this._gridSize$.asObservable();
    readonly rotationSnap$: Observable<number> = this._rotationSnap$.asObservable();

    get snapEnabled(): boolean {
        return this._snapEnabled$.value;
    }

    get gridSize(): number {
        return this._gridSize$.value;
    }

    get rotationSnap(): number {
        return this._rotationSnap$.value;
    }

    setSnapEnabled(value: boolean): void {
        this._snapEnabled$.next(value);
    }

    setGridSize(value: number): void {
        this._gridSize$.next(clamp(value, GRID.MIN, GRID.MAX));
    }

    setRotationSnap(value: number): void {
        this._rotationSnap$.next(clamp(value, ROTATION_SNAP_MIN, ROTATION_SNAP_MAX));
    }
}

function clamp(value: number, lo: number, hi: number): number {
    return Math.min(hi, Math.max(lo, value));
}
