/**
 * Array helper
 */
export class ArrayHelper {

    static has(obj, key) {
        return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
    }
}
