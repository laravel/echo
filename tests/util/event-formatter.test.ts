import { EventFormatter } from '../../src/util';

describe('EventFormatter', () => {
    let eventFormatter: EventFormatter;

    beforeEach(() => {
        eventFormatter = new EventFormatter('App.Events');
    });

    test('prepends an event with a namespace and replaces dot separators with backslashes', () => {
        let formatted = eventFormatter.format('Users.UserCreated');

        expect(formatted).toBe('App\\Events\\Users\\UserCreated');
    });

    test('does not prepend a namespace when an event starts with a dot', () => {
        let formatted = eventFormatter.format('.App\\Users\\UserCreated');

        expect(formatted).toBe('App\\Users\\UserCreated');
    });

    test('does not prepend a namespace when an event starts with a backslash', () => {
        let formatted = eventFormatter.format('\\App\\Users\\UserCreated');

        expect(formatted).toBe('App\\Users\\UserCreated');
    });

    test('does not replace dot separators when the event starts with a dot', () => {
        let formatted = eventFormatter.format('.users.created');

        expect(formatted).toBe('users.created');
    });

    test('does not replace dot separators when the event starts with a backslash', () => {
        let formatted = eventFormatter.format('\\users.created');

        expect(formatted).toBe('users.created');
    });

    test('does not prepend a namespace when none is set', () => {
        let eventFormatter = new EventFormatter(false);

        let formatted = eventFormatter.format('Users.UserCreated');

        expect(formatted).toBe('Users\\UserCreated');
    });
});
