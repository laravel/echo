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
     * Allow dot syntax.
     *
     * @type {boolean}
     */
    allowDotSyntax: boolean;

    /**
     * Create a new class instance.
     *
     * @param  {string | boolean} namespace
     * @param  {boolean} allowDotSyntax
     */
    constructor(namespace: string | boolean, allowDotSyntax: boolean) {
        this.setNamespace(namespace);
        this.setAllowDotSyntax(allowDotSyntax);
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

        if (this.allowDotSyntax) {
            return event;
        } else {
            return event.replace(/\./g, '\\');
        }
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
     * Set allowDotSyntax.
     *
     * @param  {boolean} value
     * @return {void}
     */
    setAllowDotSyntax(value: boolean): void {
        this.allowDotSyntax = value;
    }
}
