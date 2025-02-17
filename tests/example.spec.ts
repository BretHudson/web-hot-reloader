import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import {
	test,
	expect,
	type ServerFilePath,
	describeSerial,
	WHRLocator,
	BasePage,
	CSSFile,
	HTMLFile,
} from './fixtures';
import { replacementsRoot } from './shared';

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

const expectStyle = async (
	page: Page,
	property: Exclude<keyof CSSStyleDeclaration, number | Symbol>,
) => {
	const body = page.locator('body');
	const computedStyle = await body.evaluate((b, property) => {
		return window.getComputedStyle(b)[property];
	}, property);
	return computedStyle;
};

const updateCSS = async (
	page: Page,
	_fileName: CSSFile,
	serverFilePath: ServerFilePath,
	options: {
		background?: string;
		color?: string;
	},
	expectReload = true,
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

	// const expectedFileName = `${tempDir}/${serverFilePath.path}/${fileName}`;
	// const evaluate = waitForWebSocketEvent(page, 'css-update', expectedFileName);

	// await expect(cssElem).WHR_toBeReloaded();

	const updateFile = fs.promises.writeFile(cssPath, newContents);
	await updateFile;

	// const [payload] = await Promise.all([evaluate, updateFile]);

	// expect(payload).toMatchObject({
	// 	eventName: 'css-update',
	// 	data: {
	// 		fileName: expectedFileName,
	// 	},
	// });
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

		await indexPage.expectTitle(IndexPage.defaultTitle);

		const imageSrc = 'img/logo.png';
		const image = new WHRLocator(page, 'src', imageSrc);
		await expect(image).WHR_toNotBeReloaded();
		await replaceImage(imageSrc, serverFilePath);
		await expect(image).WHR_toBeReloaded();
	});

	test('replace favicon', async ({ page, serverFilePath }) => {
		const indexPage = new IndexPage(page, '', serverFilePath);
		await indexPage.goto();

		await indexPage.expectTitle(IndexPage.defaultTitle);

		const faviconSrc = 'img/favicon.png';
		const favicon = new WHRLocator(page, 'href', faviconSrc);
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

		cssElem = new WHRLocator(indexPage.page, 'href', 'css/styles.css');
		css2Elem = new WHRLocator(indexPage.page, 'href', 'css/styles2.css');
	});

	test('ensure edits are received', async () => {
		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveColor(color);

		await expect(cssElem).WHR_toNotBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		background = 'rgb(0, 0, 255)';
		await updateCSS(indexPage.page, 'styles.css', indexPage.serverFilePath, {
			background,
		});

		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveColor(color);
	});

	test('ensure multiple files are received', async () => {
		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveColor(color);

		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toNotBeReloaded();

		color = 'rgb(0, 0, 0)';
		await updateCSS(indexPage.page, 'styles2.css', indexPage.serverFilePath, {
			color,
		});

		// TODO(bret): Have some sort of check to see if it's been reloaded AGAIN
		await expect(cssElem).WHR_toBeReloaded();
		await expect(css2Elem).WHR_toBeReloaded();

		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveColor(color);
	});

	test('ensure non-included files are ignored client-side', async () => {
		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveColor(color);

		await updateCSS(
			indexPage.page,
			'styles3.css',
			indexPage.serverFilePath,
			{
				background: 'magenta',
				color: 'magenta',
			},
			false,
		);

		await expect(indexPage.page).toHaveBackgroundColor(background);
		await expect(indexPage.page).toHaveColor(color);
	});
});

describeSerial('edit CSS & image then HTML', () => {
	let indexPage: IndexPage;
	test.beforeAll(({ page, serverFilePath }) => {
		indexPage = new IndexPage(page, '', serverFilePath);
	});

	test("ensure HTML reload doesn't override reloaded assets", async ({
		page,
		serverFilePath,
	}) => {
		await indexPage.goto();

		await expect(indexPage.page).toHaveBackgroundColor('rgb(255, 0, 0)');
		await updateCSS(page, 'styles.css', serverFilePath, { background: 'blue' });
		const cssElem = new WHRLocator(indexPage.page, 'href', 'css/styles.css');
		await expect(cssElem).WHR_toBeReloaded();
		await expect(indexPage.page).toHaveBackgroundColor('rgb(0, 0, 255)');

		const imageSrc = 'img/logo.png';
		const image = new WHRLocator(page, 'src', imageSrc);
		await expect(image).WHR_toNotBeReloaded();
		await replaceImage(imageSrc, serverFilePath);
		await expect(image).WHR_toBeReloaded();

		const faviconSrc = 'img/favicon.png';
		const favicon = new WHRLocator(page, 'href', faviconSrc);
		await expect(favicon).WHR_toNotBeReloaded();
		await replaceImage(faviconSrc, serverFilePath);
		await expect(favicon).WHR_toBeReloaded();

		await indexPage.expectTitle(IndexPage.defaultTitle);
		await IndexPage.update(indexPage, 'My Cool Site');
		await indexPage.expectTitle('My Cool Site');

		// the background color should NOT be reset!
		await expect(page).toHaveBackgroundColor('rgb(0, 0, 255)');
		await expect(image).WHR_toBeReloaded();
		await expect(favicon).WHR_toBeReloaded();
	});

	test('ensure new asset changes are applied', async ({
		page,
		serverFilePath,
	}) => {
		await updateCSS(page, 'styles.css', serverFilePath, { background: 'lime' });
		const cssElem = new WHRLocator(indexPage.page, 'href', 'css/styles.css');
		// TODO(bret): This is almost definitely a race condition!
		await expect(cssElem).WHR_toBeReloaded();
		await expect(page).toHaveBackgroundColor('rgb(0, 255, 0)');
	});
});
