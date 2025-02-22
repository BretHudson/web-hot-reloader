import { type Page } from '@playwright/test';

import { constructServerFilePath } from './server-path';
import { test } from '../fixtures/fixtures';
import { Site } from './pages';

export const describeSerial = (title: string, callback: () => void) => {
	test.describe(title, async () => {
		let page: Page;

		const serverFilePath = constructServerFilePath();
		let site: Site;

		test.use({
			page: async ({ browser }, use) => {
				page ??= await browser.newPage();
				return use(page);
			},
			site: async ({ page, globalData }, use) => {
				site ??= new Site(page, constructServerFilePath(), globalData);
				return use(site);
			},
			serverFilePath: async ({}, use) => {
				return use(serverFilePath);
			},
		});

		test.describe.configure({ mode: 'serial' });

		test.beforeAll(async ({ browser, globalData }) => {
			page ??= await browser.newPage();
			site ??= new Site(page, constructServerFilePath(), globalData);
		});

		test.afterAll(async () => {
			await page.close();
		});

		callback();
	});
};
