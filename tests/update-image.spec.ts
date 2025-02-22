import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from './fixtures/fixtures';

test.describe('Image loading', () => {
	test.beforeEach(async ({ site }) => {
		await site.goto('index.html');
		await expect(site).toHaveDefaultPageTitle();
	});

	test('replace image', async ({ site }) => {
		const image = site.getImg('img/logo.png');

		await expect(image).WHR_toNotBeReloaded();
		await image.replace();
		await expect(image).WHR_toBeReloaded();
	});

	test('replace favicon', async ({ request, site }) => {
		const { page } = site;
		const favicon = site.getFavicon('img/favicon.png');

		const faviconLink = await page
			.locator('link[rel="icon"], link[rel="shortcut icon"]')
			.getAttribute('href');
		expect(faviconLink).toBeTruthy();

		const getFaviconData = async () => {
			const faviconResponse = await request.get(
				new URL(faviconLink! + '?q=123', page.url()).toString(),
			);
			expect(faviconResponse.status()).toBe(200);
			expect(faviconResponse.headers()['content-type']).toContain('image');

			const expectedFaviconPath = path.join(
				site.serverFilePath.filePath,
				favicon.src,
			);
			const expectedFaviconBuffer = await fs.promises.readFile(
				expectedFaviconPath,
			);
			const actualFaviconBuffer = Buffer.from(await faviconResponse.body());
			expect(actualFaviconBuffer).toEqual(expectedFaviconBuffer);
			return expectedFaviconBuffer;
		};

		const buffer1 = await getFaviconData();

		await expect(favicon).WHR_toNotBeReloaded();
		await favicon.replace();

		const buffer2 = await getFaviconData();

		await expect(buffer1).not.toEqual(buffer2);

		// TODO(bret): It would be nice to test this properly, but the above will do for now
		// see: https://github.com/microsoft/playwright/issues/7493#issuecomment-2676063515
		// await expect(favicon).WHR_toBeReloaded();
	});
});
