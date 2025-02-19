import { type Page } from '@playwright/test';

import { constructServerFilePath } from './server-path';
import { test } from '../fixtures/fixtures';

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
