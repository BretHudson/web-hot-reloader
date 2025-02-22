import { test, expect } from './fixtures/fixtures';
import { type CSSAsset } from './helpers/pages';
import { describeSerial } from './helpers/describe-serial';

const defaultBGColor = 'rgb(255, 0, 0)';
const defaultColor = 'rgb(255, 255, 255)';

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
