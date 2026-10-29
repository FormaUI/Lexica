import { defineConfig } from 'vitest/config';

// A path in the forward slashes Vite matches aliases by, decoded from its URL so a space in the checkout path resolves.
const resolved = path => decodeURIComponent(new URL(path, import.meta.url).pathname);

// Nexo's scripts, reached as `#nexo/`, tested in Node, where no browser global exists.
export default defineConfig({
    resolve: {
        alias: [
            { find: '#nexo/', replacement: resolved('../src/') },
        ],
    },
    test: {
        environment: 'node',
        include: ['**/*.test.js'],
    },
});
