import { EventFormatter } from '../../src/util';

describe('EventFormatter', () => {
    let eventFormatter;

    beforeEach(() => {
        eventFormatter = new EventFormatter('App.Events');
    });

    test('prepends an event with a namespace and replaces dot separators with backslashes', () => {
        const formatted = eventFormatter.format('Users.UserCreated');

        expect(formatted).toBe('App\\Events\\Users\\UserCreated');
    });

    test('does not prepend a namespace when an event starts with a dot', () => {
        const formatted = eventFormatter.format('.App\\Users\\UserCreated');

        expect(formatted).toBe('App\\Users\\UserCreated');
    });

    test('does not prepend a namespace when an event starts with a backslash', () => {
        const formatted = eventFormatter.format('\\App\\Users\\UserCreated');

        expect(formatted).toBe('App\\Users\\UserCreated');
    });

    test('does not replace dot separators when the event starts with a dot', () => {
        const formatted = eventFormatter.format('.users.created');

        expect(formatted).toBe('users.created');
    });

    test('does not replace dot separators when the event starts with a backslash', () => {
        const formatted = eventFormatter.format('\\users.created');

        expect(formatted).toBe('users.created');
    });

    test('does not prepend a namespace when none is set', () => {
        const eventFormatter = new EventFormatter(false);

        const formatted = eventFormatter.format('Users.UserCreated');

        expect(formatted).toBe('Users\\UserCreated');
    });
});
