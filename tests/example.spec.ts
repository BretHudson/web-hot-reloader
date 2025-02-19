import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from './fixtures/fixtures';
import { replacementsRoot } from './shared';
import { type ServerFilePath } from './helpers/server-path';
import {
	type BasePage,
	IndexPage,
	PageTwoPage,
	SubDirIndexPage,
	type CSSFile,
	type WHRLocator,
} from './helpers/pages';
import { describeSerial } from './helpers/describe-serial';

const updateCSS = async (
	_fileName: CSSFile,
	serverFilePath: ServerFilePath,
	options: {
		background?: string;
		color?: string;
	},
) => {
	const fileName = path.join('css', _fileName);
	const cssPath = path.join(serverFilePath.filePath, fileName);
	const cssContents = await fs.promises.readFile(cssPath, 'utf-8');

	let newContents = cssContents;
	const { background, color } = options;
	if (background) {
		newContents = newContents.replace(
			/background-color: .+;/,
			`background-color: ${background};`,
		);
	}
	if (color) {
		newContents = newContents.replace(/color: .+;/, `color: ${color};`);
	}

	return fs.promises.writeFile(cssPath, newContents);
};

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

const replaceImage = async (src: string, serverFilePath: ServerFilePath) => {
	const a = path.join(replacementsRoot, src);
	const b = path.join(serverFilePath.filePath, src);
	await fs.promises.copyFile(a, b);
};

test.describe('Image loading', () => {
	test('replace image', async ({ site }) => {
		await site.goto('index');

		await expect(site.page).toHaveTitle(IndexPage.defaultTitle);

		const imageSrc = 'img/logo.png';
		const image = site.getImg(imageSrc);
		await expect(image.locator).WHR_toNotBeReloaded();
		await image.replace();
		// await replaceImage(imageSrc, site.serverFilePath);
		await expect(image.locator).WHR_toBeReloaded();
	});

	test('replace favicon', async ({ site }) => {
		await site.goto('index');

		await expect(site.page).toHaveTitle(IndexPage.defaultTitle);

		const faviconSrc = 'img/favicon.png';
		const favicon = site.getFavicon(faviconSrc);
		await expect(favicon).WHR_toNotBeReloaded();
		await site.replaceImage(faviconSrc);
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
					basePage = new CurPageType(site.page, fileName, site.serverFilePath);
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
	let background = defaultBGColor;
	let color = defaultColor;

	let indexPage: IndexPage;
	let cssElem: WHRLocator;
	let css2Elem: WHRLocator;
	test.beforeAll(async ({ site }) => {
		indexPage = new IndexPage(site.page, '', site.serverFilePath);
		await indexPage.goto();

		cssElem = indexPage.getCSS('styles.css');
		css2Elem = indexPage.getCSS('styles2.css');
	});

	test('ensure edits are received', async () => {
		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveColor(color);

		await expect(cssElem).WHR_toNotBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		background = 'rgb(0, 0, 255)';
		await updateCSS('styles.css', indexPage.serverFilePath, {
			background,
		});

		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveColor(color);
	});

	test('ensure multiple files are received', async () => {
		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveColor(color);

		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		color = 'rgb(0, 0, 0)';
		await updateCSS('styles2.css', indexPage.serverFilePath, {
			color,
		});

		// TODO(bret): Have some sort of check to see if it's been reloaded AGAIN
		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toBeReloaded();

		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveColor(color);
	});

	test('ensure non-included files are ignored client-side', async () => {
		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveColor(color);

		await updateCSS('styles3.css', indexPage.serverFilePath, {
			background: 'magenta',
			color: 'magenta',
		});

		await expect(indexPage).toHaveBackgroundColor(background);
		await expect(indexPage).toHaveColor(color);
	});
});

describeSerial('edit CSS & image then HTML', () => {
	let indexPage: IndexPage;
	test.beforeAll(async ({ site }) => {
		indexPage = new IndexPage(site.page, '', site.serverFilePath);
		await indexPage.goto();
	});

	test("ensure HTML reload doesn't override reloaded assets", async () => {
		await expect(indexPage).toHaveBackgroundColor('rgb(255, 0, 0)');
		await updateCSS('styles.css', indexPage.serverFilePath, {
			background: 'blue',
		});
		const cssElem = indexPage.getCSS('styles.css');
		await expect(cssElem).WHR_toBeReloaded();
		await expect(indexPage).toHaveBackgroundColor('rgb(0, 0, 255)');

		const imageSrc = 'img/logo.png';
		const image = indexPage.getImg(imageSrc);
		await expect(image).WHR_toNotBeReloaded();
		await replaceImage(imageSrc, indexPage.serverFilePath);
		await expect(image).WHR_toBeReloaded();

		const faviconSrc = 'img/favicon.png';
		const favicon = indexPage.getFavicon(faviconSrc);
		await expect(favicon).WHR_toNotBeReloaded();
		await replaceImage(faviconSrc, indexPage.serverFilePath);
		await expect(favicon).WHR_toBeReloaded();

		await expect(indexPage).toHavePageTitle(IndexPage.defaultTitle);
		await IndexPage.update(indexPage, 'My Cool Site');
		await expect(indexPage).toHavePageTitle('My Cool Site');

		// the background color should NOT be reset!
		await expect(indexPage).toHaveBackgroundColor('rgb(0, 0, 255)');
		await expect(image).WHR_toBeReloaded();
		await expect(favicon).WHR_toBeReloaded();
	});

	test('ensure new asset changes are applied', async () => {
		await updateCSS('styles.css', indexPage.serverFilePath, {
			background: 'lime',
		});
		const cssElem = indexPage.getCSS('styles.css');
		// TODO(bret): This is almost definitely a race condition!
		await expect(cssElem).WHR_toBeReloaded();
		await expect(indexPage).toHaveBackgroundColor('rgb(0, 255, 0)');
	});
});
