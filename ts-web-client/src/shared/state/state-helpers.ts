/**
 * State helper functions for immutable updates
 *
 * All helpers follow strict naming conventions:
 * - get* - Read operations
 * - set* - Create/replace operations
 * - update* - Transform operations
 * - remove* - Delete operations
 */

/**
 * Get value from Map or return undefined
 */
export function getFromMap<K, V>(map: Map<K, V>, key: K): V | undefined {
    return map.get(key);
}

/**
 * Set value in Map immutably
 */
export function setInMap<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
    return new Map([...map, [key, value]]);
}

/**
 * Update value in Map immutably using updater function
 */
export function updateInMap<K, V>(
    map: Map<K, V>,
    key: K,
    updater: (value: V) => V,
): Map<K, V> {
    const value = map.get(key);
    if (!value) {
        return map;
    }

    return new Map([...map, [key, updater(value)]]);
}

/**
 * Remove value from Map immutably
 */
export function removeFromMap<K, V>(map: Map<K, V>, key: K): Map<K, V> {
    const updated = new Map(map);
    updated.delete(key);
    return updated;
}

/**
 * Get all values from Map as array
 */
export function getAllFromMap<K, V>(map: Map<K, V>): V[] {
    return Array.from(map.values());
}

/**
 * Merge object properties immutably
 */
export function mergeObject<T extends Record<string, any>>(
    obj: T,
    updates: Partial<T>,
): T {
    return { ...obj, ...updates };
}
