/**
 * Event name formatter
 */
export class EventFormatter {

    /**
     * Default event namespace.
     * @type {string}
     */
    static defaultNamespace: string = 'App.Events';

    /**
     * Format the given event name.
     * @param  {string} event
     * @return {string}
     */
    static format(event: string): string {
        if (event.charAt(0) != '\\') {
            event = this.defaultNamespace + '.' + event;
        } else {
            event = event.substr(1);
        }

        return event.replace(/\./g, '\\');
    }
}
