import { test, expect } from './fixtures/fixtures';
import {
	type BasePage,
	IndexPage,
	PageTwoPage,
	SubDirIndexPage,
	type CSSAsset,
} from './helpers/pages';
import { describeSerial } from './helpers/describe-serial';

const defaultBGColor = 'rgb(255, 0, 0)';
const defaultColor = 'rgb(255, 255, 255)';
const createTitle = (filePath: string, same: boolean) => {
	const are = same ? 'are' : 'are not';
	return `ensure ${filePath} changes ${are} applied`;
};

const options = [
	['/index.html', IndexPage],
	['/page-two.html', PageTwoPage],
	['/sub-dir/index.html', SubDirIndexPage],
] as const;

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

options.forEach(([_fileName, CurPageType]) => {
	const fileName = _fileName.replace(/^\//, '');
	const isIndex = fileName.endsWith('index.html');
	const fileNames = isIndex
		? ['', 'index', 'index.html']
		: [fileName.replace('.html', ''), fileName];
	test.describe(_fileName, () => {
		fileNames.forEach((fileName) => {
			describeSerial(`access as "/${fileName}"`, () => {
				let basePage: BasePage;
				test.beforeAll(async ({ site }) => {
					basePage = new CurPageType(site, fileName);
					await basePage.goto();
				});

				options.forEach(([fileURLToPath, PageType]) => {
					const title = createTitle(fileURLToPath, CurPageType === PageType);
					test(title, async () => {
						await PageType.update(basePage);
					});
				});

				test('ensure changes are applied, again', async () => {
					await CurPageType.update(basePage, 'A Second Update');
				});
			});
		});
	});
});

describeSerial('edit CSS', () => {
	let backgroundColor = defaultBGColor;
	let color = defaultColor;

	let indexPage: IndexPage;
	let cssElem: CSSAsset;
	let css2Elem: CSSAsset;
	test.beforeAll(async ({ site }) => {
		indexPage = new IndexPage(site, '');
		await indexPage.goto();

		cssElem = site.getCSS('styles.css');
		css2Elem = site.getCSS('styles2.css');
	});

	test('ensure edits are received', async () => {
		await expect(indexPage).toHaveStyles({
			backgroundColor,
			color,
		});

		await expect(cssElem).WHR_toNotBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		backgroundColor = 'rgb(0, 0, 255)';
		await cssElem.update({ background: backgroundColor });
		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		await expect(indexPage).toHaveStyles({
			backgroundColor,
			color,
		});
	});

	test('ensure multiple files are received', async () => {
		await expect(indexPage).toHaveStyles({
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

		await expect(indexPage).toHaveStyles({
			backgroundColor,
			color,
		});
	});

	test('ensure non-included files are ignored client-side', async () => {
		const { site } = indexPage;

		await expect(indexPage).toHaveStyles({
			backgroundColor,
			color,
		});

		await site.getCSS('styles3.css').update({
			background: 'magenta',
			color: 'magenta',
		});

		await expect(indexPage).toHaveStyles({
			backgroundColor,
			color,
		});
	});
});

describeSerial('edit CSS & image then HTML', () => {
	let indexPage: IndexPage;
	test.beforeAll(async ({ site }) => {
		indexPage = new IndexPage(site, '');
		await indexPage.goto();
	});

	test("ensure HTML reload doesn't override reloaded assets", async () => {
		const { site } = indexPage;

		await expect(indexPage).toHaveStyles({
			backgroundColor: 'rgb(255, 0, 0)',
		});
		const cssElem = site.getCSS('styles.css');
		await cssElem.update({ background: 'blue' });
		await expect(cssElem).WHR_toBeReloaded();
		await expect(indexPage).toHaveStyles({
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

		await expect(site).toHavePageTitle_Site(IndexPage.defaultTitle);
		await IndexPage.update(indexPage, 'My Cool Site');
		await expect(site).toHavePageTitle_Site('My Cool Site');

		// the background color should NOT be reset!
		await expect(indexPage).toHaveStyles({
			backgroundColor: 'rgb(0, 0, 255)',
		});
		await expect(image).WHR_toBeReloaded();
		await expect(favicon).WHR_toBeReloaded();
	});

	test('ensure new asset changes are applied', async () => {
		const { site } = indexPage;

		const cssElem = site.getCSS('styles.css');
		await cssElem.update({ background: 'lime' });
		// TODO(bret): This is almost definitely a race condition! (because it's been reloaded before)
		await expect(cssElem).WHR_toBeReloaded();
		await expect(indexPage).toHaveStyles({
			backgroundColor: 'rgb(0, 255, 0)',
		});
	});
});
