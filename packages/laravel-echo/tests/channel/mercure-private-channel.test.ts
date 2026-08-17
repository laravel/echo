import { describe, expect, test, vi } from "vitest";
import {
    MercureEncryptedPrivateChannel,
    MercurePrivateChannel,
} from "../../src/channel";
import type { MercureWhisperPublisher } from "../../src/channel";
import { Connector } from "../../src/connector";

function makeChannel(whisperer?: MercureWhisperPublisher) {
    return new MercurePrivateChannel(
        "private-room.1",
        {
            broadcaster: "mercure",
            ...Connector._defaultOptions,
            namespace: false,
        },
        whisperer,
    );
}

describe("MercurePrivateChannel", () => {
    test("whisper() delegates to the connector and returns the channel", () => {
        const whisperer = { whisper: vi.fn() };
        const channel = makeChannel(whisperer);

        expect(channel.whisper("typing", { name: "alice" })).toBe(channel);
        expect(whisperer.whisper).toHaveBeenCalledWith(
            "private-room.1",
            "typing",
            { name: "alice" },
        );
    });

    test("whisper() throws when constructed without a connector", () => {
        expect(() => makeChannel().whisper("typing", {})).toThrow(
            "without a connector",
        );
    });

    test("listenForWhisper() registers the client event without warning", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        try {
            const channel = makeChannel();
            const callback = vi.fn();

            channel.listenForWhisper("typing", callback);
            channel.dispatch("client-typing", { name: "alice" });

            expect(callback).toHaveBeenCalledWith({ name: "alice" });
            expect(warn).not.toHaveBeenCalled();
        } finally {
            warn.mockRestore();
        }
    });

    test("an encrypted private channel whispers like a private one", () => {
        const whisperer = { whisper: vi.fn() };
        const channel = new MercureEncryptedPrivateChannel(
            "private-encrypted-room.1",
            {
                broadcaster: "mercure",
                ...Connector._defaultOptions,
                namespace: false,
            },
            whisperer,
        );

        channel.whisper("typing", {});

        expect(whisperer.whisper).toHaveBeenCalledWith(
            "private-encrypted-room.1",
            "typing",
            {},
        );
    });
});
