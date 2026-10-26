/**
 * The folders tests read from
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository's root folder, which holds the sources, the documents and the package's manifest. */
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
