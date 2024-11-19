function isConstructor(obj: any): obj is new (...args: any[]) => any {
    try {
        new obj();
    } catch (err) {
        if (err.message.includes('is not a constructor')) return false;
    }
    return true;
}

export { isConstructor };
export * from './event-formatter';
