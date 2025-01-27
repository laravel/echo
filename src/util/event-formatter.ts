/**
 * Event name formatter
 */
export class EventFormatter {
    /**
     * Create a new class instance.
     */
    constructor(private namespace: string | boolean | undefined) {
        //
    }

    /**
     * Format the given event name.
     */
    format(event: string): string {
        if (['.', '\\'].includes(event.charAt(0))) {
            return event.substring(1);
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
