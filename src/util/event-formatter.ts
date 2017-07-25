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
     * Format event names.
     *
     * @param  {boolean}
     */
    formatEvents: boolean;

    /**
     * Create a new class instance.
     *
     * @param  {string | boolean} namespace
     * @param  {boolean} formatEvents
     */
    constructor(namespace: string | boolean, formatEvents: boolean) {
        this.setNamespace(namespace);
        this.setFormatEvents(formatEvents);
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

        if (this.formatEvents) {
            event = event.replace(/\./g, '\\');
        }

        return event;
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

    /**
     * Set the formatEvents.
     *
     * @param  {boolean} value
     * @return {void}
     */
    setFormatEvents(value: boolean): void {
        this.formatEvents = value;
    }
}
