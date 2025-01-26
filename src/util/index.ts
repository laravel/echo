function isConstructor(obj: unknown): obj is new (...args: any[]) => any {
    if (typeof obj !== 'function') {
        return false;
    }

    try {
        Reflect.construct(String, [], obj);
    } catch (err) {
        return false;
    }

    return true;
}

export { isConstructor };
export * from './event-formatter';
