function isConstructor(obj: unknown): obj is new (...args: any[]) => any {
    try {
        // Avoid side effects when instantiating connector classes...
        Reflect.construct(String, [], obj as new (...args: any[]) => any);
        return true;
    } catch {
        return false;
    }
}

export { isConstructor };
export * from "./event-formatter";
