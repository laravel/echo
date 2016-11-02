/**
 * Event name formatter
 */
export class EventFormatter {

    /**
     * Event namespace.
     *
     * @type {string}
     */
    namespace: string | boolean;

    /**
     * Create a new class instance.
     *
     * @params  {string | boolean} namespace
     */
    constructor(namespace: string | boolean) {
        this.setNamespace(namespace);
    }

    /**
     * Format the given event name.
     *
     * @param  {string} event
     * @return {string}
     */
    format(event: string): string {
        if (this.namespace) {
            if (event.charAt(0) != '\\' && event.charAt(0) != '.') {
                event = this.namespace + '.' + event;
            } else {
                event = event.substr(1);
            }
        }

        return event.replace(/\./g, '\\');
    }

    /**
     * Set the event namespace.
     *
     * @param  {string} value
     * @return {void}
     */
    setNamespace(value: string | boolean): void {
        this.namespace = value;
    }
}
