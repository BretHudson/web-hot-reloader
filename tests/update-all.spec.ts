import { test, expect } from './fixtures/fixtures';
import { describeSerial } from './helpers/describe-serial';

describeSerial('edit CSS & image then HTML', () => {
	test.beforeAll(async ({ site }) => {
		await site.goto('index.html');
	});

	test("ensure HTML reload doesn't override reloaded assets", async ({
		site,
	}) => {
		await expect(site.page).toHaveStyles({
			backgroundColor: 'rgb(255, 0, 0)',
		});
		const cssElem = site.getCSS('styles.css');
		await cssElem.update({ background: 'blue' });
		await expect(cssElem).WHR_toBeReloaded();
		await expect(site.page).toHaveStyles({
			backgroundColor: 'rgb(0, 0, 255)',
		});

		const imageSrc = 'img/logo.png';
		const image = site.getImg(imageSrc);
		await expect(image).WHR_toNotBeReloaded();
		await image.replace();
		await expect(image).WHR_toBeReloaded();

		const faviconSrc = 'img/favicon.png';
		const favicon = site.getFavicon(faviconSrc);
		await expect(favicon).WHR_toNotBeReloaded();
		await favicon.replace();
		// TODO(bret): Do new favicon reload here
		// await expect(favicon).WHR_toBeReloaded();

		await expect(site).toHaveDefaultPageTitle();
		await site.updateHTML('index.html', 'My Cool Site');
		await expect(site).toHavePageTitle('My Cool Site');

		// the background color should NOT be reset!
		await expect(site.page).toHaveStyles({
			backgroundColor: 'rgb(0, 0, 255)',
		});
		await expect(image).WHR_toBeReloaded();
		// TODO(bret): Do new favicon reload here
		// await expect(favicon).WHR_toBeReloaded();
	});

	test('ensure new asset changes are applied', async ({ site }) => {
		const cssElem = site.getCSS('styles.css');
		await cssElem.update({ background: 'lime' });
		// TODO(bret): This is almost definitely a race condition! (because it's been reloaded before)
		await expect(cssElem).WHR_toBeReloaded();
		await expect(site.page).toHaveStyles({
			backgroundColor: 'rgb(0, 255, 0)',
		});
	});
});
