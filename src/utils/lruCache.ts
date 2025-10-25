/**
 * Simple LRU (Least Recently Used) cache implementation for performance optimization.
 *
 * @module src/utils/lruCache
 */

/**
 * A generic LRU cache that evicts the least recently used items when capacity is reached.
 */
export class LRUCache<K, V> {
  private readonly capacity: number;
  private cache: Map<K, V>;

  /**
   * Creates a new LRU cache with the specified capacity.
   *
   * @param capacity - Maximum number of items to store.
   */
  constructor(capacity: number) {
    this.capacity = capacity;
    this.cache = new Map<K, V>();
  }

  /**
   * Retrieves a value from the cache.
   * Moves the item to the end (most recently used position).
   *
   * @param key - Cache key to retrieve.
   * @returns Cached value or undefined if not found.
   */
  get(key: K): V | undefined {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * Stores a value in the cache.
   * If capacity is exceeded, removes the least recently used item.
   *
   * @param key - Cache key.
   * @param value - Value to cache.
   */
  set(key: K, value: V): void {
    // If key exists, delete it first to update position
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value as K;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, value);
  }

  /**
   * Checks if a key exists in the cache.
   *
   * @param key - Cache key to check.
   * @returns True if key exists.
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Removes a specific key from the cache.
   *
   * @param key - Cache key to remove.
   * @returns True if key was removed.
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all items from the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Returns the current number of items in the cache.
   */
  get size(): number {
    return this.cache.size;
  }
}
