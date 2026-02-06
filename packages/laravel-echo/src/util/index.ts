function isConstructor(obj: unknown): obj is new (...args: any[]) => any {
    try {
        // Use Reflect.construct with a dummy target to check if obj
        // can serve as a constructor without actually executing its
        // constructor body. This avoids side effects (e.g. network
        // requests) that occur when instantiating connector classes.
        Reflect.construct(String, [], obj as new (...args: any[]) => any);
        return true;
    } catch {
        return false;
    }
}

export { isConstructor };
export * from "./event-formatter";
