import { test, expect } from './fixtures/fixtures';
import { type CSSAsset } from './helpers/pages';
import { describeSerial } from './helpers/describe-serial';
import { pagePaths } from './shared';

const defaultBGColor = 'rgb(255, 0, 0)';
const defaultColor = 'rgb(255, 255, 255)';

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

test.describe(() => {
	const pathWithAliases = pagePaths.map((urlPath) => {
		let aliases: string[] = [];
		if (urlPath.endsWith('index.html')) {
			aliases.push(urlPath.replace('index.html', ''));
		}
		if (urlPath.endsWith('.html')) {
			aliases.push(urlPath.replace('.html', ''));
		}
		aliases.push(urlPath);
		return [urlPath, aliases] as [typeof urlPath, typeof aliases];
	});

	pathWithAliases.forEach(([urlPath, aliases]) => {
		test.describe(urlPath, () => {
			aliases.forEach((alias) => {
				const aliasTitle = `"/${alias}"`;
				describeSerial(`as ${aliasTitle}`, () => {
					const changes = (updatePath) =>
						urlPath === updatePath ? '' : 'not ';

					test(`visit ${aliasTitle}, expect default title`, async ({
						site,
					}) => {
						site.setPagePathAlias(urlPath, alias);
						await site.goto(urlPath);
						await expect(site).toHaveDefaultPageTitle();
					});

					// const updatePath = 'page-two.html';
					pagePaths.forEach((updatePath) => {
						test(`expect ${updatePath} update to ${changes(
							updatePath,
						)}cause changes`, async ({ site }) => {
							const newTitle = [
								site.pages[urlPath].currentTitle,
								'Updated',
							].join(' | ');
							await site.updateHTML(updatePath, newTitle);
							await expect(site).toHavePageTitle(
								site.pages[urlPath].currentTitle,
							);
						});
					});
				});
			});
		});
	});
});

describeSerial('edit CSS', () => {
	let backgroundColor = defaultBGColor;
	let color = defaultColor;

	let cssElem: CSSAsset;
	let css2Elem: CSSAsset;
	test.beforeAll(async ({ site }) => {
		await site.goto('index.html');

		cssElem = site.getCSS('styles.css');
		css2Elem = site.getCSS('styles2.css');
	});

	test('ensure edits are received', async ({ site }) => {
		await expect(site.page).toHaveStyles({
			backgroundColor,
			color,
		});

		await expect(cssElem).WHR_toNotBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		backgroundColor = 'rgb(0, 0, 255)';
		await cssElem.update({ background: backgroundColor });
		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		await expect(site.page).toHaveStyles({
			backgroundColor,
			color,
		});
	});

	test('ensure multiple files are received', async ({ site }) => {
		await expect(site.page).toHaveStyles({
			backgroundColor,
			color,
		});

		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		color = 'rgb(0, 0, 0)';
		await css2Elem.update({ color });

		// TODO(bret): Have some sort of check to see if it's been reloaded AGAIN
		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toBeReloaded();

		await expect(site.page).toHaveStyles({
			backgroundColor,
			color,
		});
	});

	test('ensure non-included files are ignored client-side', async ({
		site,
	}) => {
		await expect(site.page).toHaveStyles({
			backgroundColor,
			color,
		});

		await site.getCSS('styles3.css').update({
			background: 'magenta',
			color: 'magenta',
		});

		await expect(site.page).toHaveStyles({
			backgroundColor,
			color,
		});
	});
});

describeSerial('edit CSS & image then HTML', () => {
	test.beforeAll(async ({ site }) => {
		site.goto('index.html');
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
		await expect(favicon).WHR_toBeReloaded();

		await expect(site).toHaveDefaultPageTitle();
		await site.updateHTML('index.html', 'My Cool Site');
		await expect(site).toHavePageTitle('My Cool Site');

		// the background color should NOT be reset!
		await expect(site.page).toHaveStyles({
			backgroundColor: 'rgb(0, 0, 255)',
		});
		await expect(image).WHR_toBeReloaded();
		await expect(favicon).WHR_toBeReloaded();
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
