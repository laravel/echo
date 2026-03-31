/**
 * Svelte 5 runes are compiler macros; these declarations allow TypeScript
 * to type-check code that uses runes before the Svelte compiler runs.
 */
declare global {
    function $state<T>(initial: T): T;
    function $state<T>(): T | undefined;
    function $effect(fn: () => void | (() => void)): void;
    function $derived<T>(expression: T): T;
}

export {};
