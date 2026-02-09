import { describe, expect, test, vi } from "vitest";
import { isConstructor } from "../../src/util";

describe("isConstructor", () => {
    test("it returns true for a class", () => {
        class MyClass {}
        expect(isConstructor(MyClass)).toBe(true);
    });

    test("it returns true for a regular function", () => {
        function MyFunction() {}
        expect(isConstructor(MyFunction)).toBe(true);
    });

    test("it returns false for an arrow function", () => {
        const arrow = () => {};
        expect(isConstructor(arrow)).toBe(false);
    });

    test("it returns false for a non-function value", () => {
        expect(isConstructor("string")).toBe(false);
        expect(isConstructor(42)).toBe(false);
        expect(isConstructor(null)).toBe(false);
        expect(isConstructor(undefined)).toBe(false);
        expect(isConstructor({})).toBe(false);
    });

    test("it does not execute the constructor body", () => {
        const sideEffect = vi.fn();

        class SideEffectClass {
            constructor() {
                sideEffect();
            }
        }

        isConstructor(SideEffectClass);
        expect(sideEffect).not.toHaveBeenCalled();
    });
});
