/**
 * Event name formatter
 */
export class EventFormatter {

    constructor() {
        /**
         * Default event namespace.
         *
         * @type {string}
         */
        this.defaultNamespace = 'App.Events';
    }


    /**
     * Format the given event name.
     *
     * @param  {string} event
     * @return {string}
     */
    format(event) {
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
    namespace(value) {
        this.defaultNamespace = value;
    }
}
