/**
 * Event name formatter
 */
export class EventFormatter {

    /**
     * Global options
     *
     * @type: {object}
     */
    settings: any;

    constructor(settings: any) {
        this.settings = settings;
    }

    /**
     * Format the given event name.
     *
     * @param  {string} event
     * @return {string}
     */
    format(event: string): string {
        // If we're prefixing the event with namespaces and the first char isn't '\' or '.'
        if (this.settings.prefixNamespace && event.charAt(0) != '\\' && event.charAt(0) != '.')
        {
            event = this.settings.defaultNamespace + '.' + event;
        }
        // If we're prefixing and one of those chars start off the string
        else if(this.settings.prefixNamespace)
        {
            event = event.substr(1);
        }

        // If we're converting namespaces, replace '.' with '\'
        return (this.settings.convertNameSpaces) ? event.replace(/\./g, '\\') : event;
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
