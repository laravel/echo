/**
 * Event name formatter
 */
export class EventFormatter {
    /**
     * Create a new class instance.
     */
    constructor(private namespace: string | boolean) {
        //
    }

    /**
     * Format the given event name.
     */
    format(event: string): string {
        if (event.charAt(0) === '.' || event.charAt(0) === '\\') {
            return event.substr(1);
        } else if (this.namespace) {
            event = this.namespace + '.' + event;
        }

        return event.replace(/\./g, '\\');
    }

    /**
     * Set the event namespace.
     */
    setNamespace(value: string | boolean): void {
        this.namespace = value;
    }
}
