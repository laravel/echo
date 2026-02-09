export const toArray = <T>(item: T | T[]): T[] =>
    Array.isArray(item) ? item : [item];
