/// <reference types="node" />

import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

test.each(["react", "vue", "svelte"])(
    "checks the published %s adapter without installing its development dependencies",
    (adapter) => {
        const directory = mkdtempSync(join(tmpdir(), "echo-types-"));
        const packageDirectory = resolve(import.meta.dirname, "../..", adapter);
        const installedPackage = join(
            directory,
            "node_modules/@laravel",
            `echo-${adapter}`,
        );

        try {
            mkdirSync(installedPackage, { recursive: true });
            cpSync(
                join(packageDirectory, "dist"),
                join(installedPackage, "dist"),
                { recursive: true },
            );
            cpSync(
                join(packageDirectory, "package.json"),
                join(installedPackage, "package.json"),
            );
            const { dependencies = {} } = JSON.parse(
                readFileSync(join(installedPackage, "package.json"), "utf8"),
            );

            for (const dependency of [
                ...Object.keys(dependencies),
                adapter,
                "pusher-js",
                ...(adapter === "react" ? ["@types/react"] : []),
            ]) {
                const destination = join(directory, "node_modules", dependency);
                mkdirSync(resolve(destination, ".."), { recursive: true });
                symlinkSync(
                    join(packageDirectory, "node_modules", dependency),
                    destination,
                    "junction",
                );
            }

            const entry = join(directory, "index.ts");
            writeFileSync(
                entry,
                `import type Echo from 'laravel-echo';
            import { configureEcho, echo } from '@laravel/echo-${adapter}';
            configureEcho({ broadcaster: 'reverb' });
            const instance: Echo<'reverb'> = echo<'reverb'>();
            instance.private('orders').listen('created', () => {});`,
            );

            const program = ts.createProgram([entry], {
                noEmit: true,
                strict: true,
                skipLibCheck: false,
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                types: [],
            });

            expect(
                ts
                    .getPreEmitDiagnostics(program)
                    .map((diagnostic) =>
                        ts.flattenDiagnosticMessageText(
                            diagnostic.messageText,
                            "\n",
                        ),
                    ),
            ).toEqual([]);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    },
);
