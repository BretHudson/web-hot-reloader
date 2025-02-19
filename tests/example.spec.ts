import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { test, expect } from './fixtures/fixtures';
import { replacementsRoot } from './shared';
import { type ServerFilePath } from './helpers/server-path';
import {
	BasePage,
	type HTMLFile,
	type CSSFile,
	type WHRLocator,
} from './helpers/pages';
import { describeSerial } from './helpers/describe-serial';

class IndexPage extends BasePage {
	static defaultTitle = 'My Site';
	static updatedTitle = 'My Cool Site';
	static filePath: HTMLFile = 'index.html';
	curTitle = IndexPage.defaultTitle;
}

class PageTwoPage extends BasePage {
	static defaultTitle = 'Page Two';
	static updatedTitle = 'Page II';
	static filePath: HTMLFile = 'page-two.html';
	curTitle = PageTwoPage.defaultTitle;
}

class SubDirIndexPage extends BasePage {
	static defaultTitle = 'A Subdirectory';
	static updatedTitle = 'A Sub Dir';
	static filePath: HTMLFile = 'sub-dir/index.html';
	curTitle = SubDirIndexPage.defaultTitle;

	constructor(page: Page, path: string, serverFilePath: ServerFilePath) {
		super(page, 'sub-dir/' + path, serverFilePath);
	}
}

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
	test('replace image', async ({ page, serverFilePath }) => {
		const indexPage = new IndexPage(page, '', serverFilePath);
		await indexPage.goto();

		await expect(indexPage).toHaveTitle(IndexPage.defaultTitle);

		const imageSrc = 'img/logo.png';
		const image = indexPage.getImg(imageSrc);
		await expect(image).WHR_toNotBeReloaded();
		await replaceImage(imageSrc, serverFilePath);
		await expect(image).WHR_toBeReloaded();
	});

	test('replace favicon', async ({ page, serverFilePath }) => {
		const indexPage = new IndexPage(page, '', serverFilePath);
		await indexPage.goto();

		await expect(indexPage).toHaveTitle(IndexPage.defaultTitle);

		const faviconSrc = 'img/favicon.png';
		const favicon = indexPage.getFavicon(faviconSrc);
		await expect(favicon).WHR_toNotBeReloaded();
		await replaceImage(faviconSrc, serverFilePath);
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
				test.beforeAll(async ({ page, serverFilePath }) => {
					basePage = new CurPageType(page, fileName, serverFilePath);
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
	test.beforeAll(async ({ page, serverFilePath }) => {
		indexPage = new IndexPage(page, '', serverFilePath);
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
	test.beforeAll(async ({ page, serverFilePath }) => {
		indexPage = new IndexPage(page, '', serverFilePath);
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

		await expect(indexPage).toHaveTitle(IndexPage.defaultTitle);
		await IndexPage.update(indexPage, 'My Cool Site');
		await expect(indexPage).toHaveTitle('My Cool Site');

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
