function isConstructor(obj: unknown): obj is new (...args: any[]) => any {
    try {
        new (obj as new (...args: any[]) => any)();
    } catch (err) {
        if (err instanceof Error && err.message.includes('is not a constructor')) {
            return false;
        }
    }

    return true;
}

export { isConstructor };
export * from './event-formatter';
