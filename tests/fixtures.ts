import path from 'node:path';
import { test as base } from '@playwright/test';

import { tempRoot, SERVER_PORT, tempDir } from './shared';

export interface Fixtures {
	serverFilePath: {
		path: string;
		url: string;
		filePath: string;
	};
}

let count = 0;

export * from '@playwright/test';
export const test = base.extend<Fixtures>({
	serverFilePath: async ({}, use) => {
		const _path = `test-${count++}`;
		const data = {
			path: _path,
			url: `http://localhost:${SERVER_PORT}/${tempDir}/${_path}/`,
			filePath: path.join(tempRoot, _path),
		};
		await use(data);
	},
});
