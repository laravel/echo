export function resolveCsrf(fallback: string | null = null): string | null {
    let selector;

    if (typeof window !== 'undefined' && window['Laravel'] && window['Laravel'].csrfToken) {
        return window['Laravel'].csrfToken;
    }

    if (fallback) {
        return fallback;
    }

    if (
      typeof document !== 'undefined' &&
      typeof document.querySelector === 'function' &&
      (selector = document.querySelector('meta[name="csrf-token"]'))
    ) {
        return selector?.getAttribute('content') || null;
    }

    return null;
}
