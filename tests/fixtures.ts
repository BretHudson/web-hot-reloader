import path from 'node:path';
import { test as base, type Page } from '@playwright/test';

import { tempRoot, SERVER_PORT, tempDir } from './shared';

export interface ServerFilePath {
	path: string;
	url: string;
	filePath: string;
}

export interface Fixtures {
	serverFilePath: ServerFilePath;
}

let count = 0;

const constructServerFilePath = () => {
	const _path = `test-${count++}`;
	const data = {
		path: _path,
		url: `http://localhost:${SERVER_PORT}/${tempDir}/${_path}/`,
		filePath: path.join(tempRoot, _path),
	};
	return data;
};

export * from '@playwright/test';
export const test = base.extend<Fixtures>({
	serverFilePath: [
		async ({}, use) => {
			const data = constructServerFilePath();
			await use(data);
		},
		{ option: true, scope: 'test' },
	],
});

export const describeSerial = (title: string, callback: () => void) => {
	test.describe(title, async () => {
		let page: Page;

		const serverFilePath = constructServerFilePath();

		test.use({
			serverFilePath: async ({}, use) => {
				return use(serverFilePath);
			},
			page: async ({ browser }, use) => {
				page ??= await browser.newPage();
				return use(page);
			},
		});

		test.describe.configure({ mode: 'serial' });

		test.beforeAll(async ({ browser }) => {
			page ??= await browser.newPage();
		});

		test.afterAll(async () => {
			await page.close();
		});

		callback();
	});
};
