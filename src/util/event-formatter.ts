/**
 * Event name formatter
 */
export class EventFormatter {

    /**
     * Default event namespace.
     *
     * @type {string}
     */
    defaultNamespace: string = 'App.Events';

    /**
     * Format the given event name.
     *
     * @param  {string} event
     * @return {string}
     */
    format(event: string): string {
        if (event.charAt(0) != '\\') {
            event = this.defaultNamespace + '.' + event;
        } else {
            event = event.substr(1);
        }

        return event.replace(/\./g, '\\');
    }

    /**
     * Set the default event namespace.
     *
     * @param  {string} value
     * @return {void}
     */
    namespace(value: string): void {
        this.defaultNamespace = value;
    }
}
