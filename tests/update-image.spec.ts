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

	test('replace favicon', async ({ site }) => {
		const favicon = site.getFavicon('img/favicon.png');

		await expect(favicon).WHR_toNotBeReloaded();
		await favicon.replace();
		await expect(favicon).WHR_toBeReloaded();
	});
});
