# Contributing

Thank you for your interest in contributing to Laravel Echo! Your contributions help make this project better for everyone.

Echo is maintained as a monorepo using [pnpm workspaces](https://pnpm.io/workspaces). Below you'll find an overview of the repository and how to get your development environment running.

> **Note:** You'll need **pnpm version 12 or higher**. If you're unsure which version you have, run `pnpm -v`.

## Repository Overview

```
echo/
├── packages/
│   ├── laravel-echo/    Core library
│   ├── react/           React hooks
│   │   └── tests/       React tests
│   ├── svelte/          Svelte runes
│   │   └── tests/       Svelte tests
│   └── vue/             Vue hooks
│       └── tests/       Vue Tests
```

## Getting Started

Clone the repository and install the dependencies:

```sh
git clone https://github.com/laravel/echo.git echo
cd echo
pnpm install
```

Then, start the development environment:

```sh
pnpm dev
```

This builds the core library and of the package variants, and starts a file watcher that will automatically rebuild each package when changes are made.

If you prefer, you can also start individual watchers from each package directory. For example:

```sh
cd packages/laravel-echo && pnpm dev
cd packages/react && pnpm dev
cd packages/svelte && pnpm dev
cd packages/vue && pnpm dev
```

> **Note:** The core package (`packages/laravel-echo`) must always be running, as all adapters depend on it.

## Running Tests

Run all tests:

```sh
pnpm test
```

Run the test suite for a specific adapter:

```sh
cd packages/laravel-echo && pnpm test
cd packages/react && pnpm test
cd packages/svelte && pnpm test
cd packages/vue && pnpm test
```
