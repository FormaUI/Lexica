/**
 * The update descriptions tests' declarations share, each as a declaration's `updates` writes it
 */

/** A member whose answer never changes, read fresh each time. */
export const constantUpdates = { changes: 'constant', reads: 'fresh' };

/** A member whose answer changes as what it derives from does, which it derives its reads from. */
export const derivedUpdates = { changes: 'derived', reads: 'derived' };
