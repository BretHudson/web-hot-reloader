import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import {
	test,
	expect,
	type ServerFilePath,
	describeSerial,
	WHRLocator,
} from './fixtures';
import { replacementsRoot, tempDir, templateRoot } from './shared';

abstract class BasePage {
	static defaultTitle: string;
	static updatedTitle: string;
	static filePath: HTMLFile;

	page: Page;
	path: string;
	serverFilePath: ServerFilePath;
	curTitle: string;

	constructor(page: Page, path: string, serverFilePath) {
		this.page = page;
		this.path = path;
		this.serverFilePath = serverFilePath;

		// TODO(bret): Move this, I don't love it here
		if (fs.existsSync(serverFilePath.filePath)) return;
		fs.cpSync(templateRoot, serverFilePath.filePath, {
			recursive: true,
		});
	}

	async goto() {
		const url = this.serverFilePath.url + this.path;
		return this.page.goto(url);
	}

	async expectTitle(title: string, match: boolean = true) {
		if (match) await expect(this.page).toHaveTitle(title);
		else await expect(this.page).not.toHaveTitle(title);
	}

	static async update(page: BasePage, pageTitle: string = this.updatedTitle) {
		let isSamePage = page instanceof this;

		const titleToReplace = isSamePage ? page.curTitle : this.defaultTitle;

		await page.expectTitle(page.curTitle, true);
		await updateHTML(page, this.filePath, page.serverFilePath, (htmlContents) =>
			htmlContents.replace(titleToReplace, pageTitle),
		);
		if (isSamePage) {
			page.curTitle = pageTitle;
		}
		await page.expectTitle(pageTitle, isSamePage);
	}
}

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

const waitForWebSocketEvent = (page: Page, event: string, fileName: string) => {
	return page.evaluate(
		({ event, fileName }) => {
			return new Promise<{ eventName: string; data: {} }>((resolve) => {
				const _window = window as typeof window & { '__whr-socket': any };
				_window['__whr-socket'].onAny((eventName, data) => {
					if (eventName === event && data.fileName === fileName) {
						resolve({ eventName, data });
					}
				});
			});
		},
		{ event, fileName },
	);
};

type CSSFile = 'styles.css' | 'styles2.css' | 'styles3.css';
type HTMLFile = 'index.html' | 'page-two.html' | 'sub-dir/index.html';

const updateCSS = async (
	page: Page,
	fileName: CSSFile,
	serverFilePath: ServerFilePath,
	options: {
		background?: string;
		color?: string;
	},
) => {
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

	const expectedFileName = `${tempDir}/${serverFilePath.path}/${fileName}`;
	const evaluate = waitForWebSocketEvent(page, 'css-update', expectedFileName);

	const updateFile = fs.promises.writeFile(cssPath, newContents);

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'css-update',
		data: {
			fileName: expectedFileName,
		},
	});
};

const updateHTML = async (
	basePage: BasePage,
	fileName: HTMLFile,
	serverFilePath: ServerFilePath,
	replacement: (str: string) => string,
) => {
	const htmlPath = path.join(serverFilePath.filePath, fileName);
	const htmlContents = await fs.promises.readFile(htmlPath, 'utf-8');

	const { page } = basePage;

	const expectedFileName = `${tempDir}/${serverFilePath.path}/${fileName}`;
	const evaluate = waitForWebSocketEvent(page, 'html-update', expectedFileName);

	const updateFile = fs.promises.writeFile(htmlPath, replacement(htmlContents));

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'html-update',
		data: {
			fileName: expectedFileName,
		},
	});
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
// test.describe('/index.html old', () => {
// 	['', 'index', 'index.html'].forEach((fileName) => {
// 		describeSerial(`access as "/${fileName}"`, () => {
// 			const CurPageType = IndexPage;

// 			let indexPage: IndexPage;
// 			test.beforeAll(async ({ page, serverFilePath }) => {
// 				indexPage = new IndexPage(page, fileName, serverFilePath);
// 				await indexPage.goto();
// 			});

// 			options.forEach(([fileURLToPath, PageType]) => {
// 				const title = createTitle(fileURLToPath, CurPageType === PageType);
// 				test(title, async () => {
// 					await PageType.update(indexPage);
// 				});
// 			});

// 			test('ensure changes are applied, again', async () => {
// 				await CurPageType.update(indexPage, 'A Second Update');
// 			});
// 		});
// 	});
// });

// test.describe('/page-two.html', () => {
// 	['page-two', 'page-two.html'].forEach((fileName) => {
// 		describeSerial(`as "/${fileName}"`, () => {
// 			let pageTwo: PageTwoPage;
// 			test.beforeAll(async ({ page, serverFilePath }) => {
// 				pageTwo = new PageTwoPage(page, fileName, serverFilePath);
// 				await pageTwo.goto();
// 			});

// 			test('ensure changes are received', async () => {
// 				await PageTwoPage.update(pageTwo, 'Page II');
// 			});

// 			test('ensure changes to another .html file are not received', async () => {
// 				await SubDirIndexPage.update(pageTwo, 'A Sub Dir');
// 			});

// 			test('2 ensure changes to another .html file are not received', async () => {
// 				await IndexPage.update(pageTwo, 'My Cool Site');
// 			});
// 		});
// 	});
// });

// test.describe('/sub-dir/index.html', () => {
// 	['', 'index', 'index.html'].forEach((fileName) => {
// 		describeSerial(`as "/${fileName}"`, () => {
// 			let subDirIndexPage: SubDirIndexPage;
// 			test.beforeAll(async ({ page, serverFilePath }) => {
// 				subDirIndexPage = new SubDirIndexPage(page, fileName, serverFilePath);
// 				await subDirIndexPage.goto();
// 			});

// 			test('ensure changes are received', async () => {
// 				await SubDirIndexPage.update(subDirIndexPage, 'A Sub Dir');
// 			});

// 			test('ensure changes to another .html file are not received', async () => {
// 				await PageTwoPage.update(subDirIndexPage, 'Page II');
// 			});

// 			test('ensure changes to another index.html file are not received', async () => {
// 				await IndexPage.update(subDirIndexPage, 'My Cool Site');
// 			});
// 		});
// 	});
// });

// TODO(bret): Make sure only the HTML page that is currently loaded refreshes!!

describeSerial('edit CSS', () => {
	let background = defaultBGColor;
	let color = defaultColor;

	let indexPage: IndexPage;
	test.beforeAll(async ({ page, serverFilePath }) => {
		indexPage = new IndexPage(page, '', serverFilePath);
		await indexPage.goto();
	});

	test('ensure edits are received', async () => {
		expect(await expectStyle(indexPage.page, 'backgroundColor')).toEqual(
			background,
		);
		expect(await expectStyle(indexPage.page, 'color')).toEqual(color);

		background = 'rgb(0, 0, 255)';
		await updateCSS(indexPage.page, 'styles.css', indexPage.serverFilePath, {
			background,
		});
		expect(await expectStyle(indexPage.page, 'backgroundColor')).toEqual(
			background,
		);
		expect(await expectStyle(indexPage.page, 'color')).toEqual(color);
	});

	test('ensure multiple files are received', async () => {
		expect(await expectStyle(indexPage.page, 'backgroundColor')).toEqual(
			background,
		);
		expect(await expectStyle(indexPage.page, 'color')).toEqual(color);

		color = 'rgb(0, 0, 0)';
		await updateCSS(indexPage.page, 'styles2.css', indexPage.serverFilePath, {
			color,
		});
		expect(await expectStyle(indexPage.page, 'backgroundColor')).toEqual(
			background,
		);
		expect(await expectStyle(indexPage.page, 'color')).toEqual(color);
	});

	test('ensure non-included files are ignored client-side', async () => {
		expect(await expectStyle(indexPage.page, 'backgroundColor')).toEqual(
			background,
		);
		expect(await expectStyle(indexPage.page, 'color')).toEqual(color);

		await updateCSS(indexPage.page, 'styles3.css', indexPage.serverFilePath, {
			background: 'magenta',
			color: 'magenta',
		});
		expect(await expectStyle(indexPage.page, 'backgroundColor')).toEqual(
			background,
		);
		expect(await expectStyle(indexPage.page, 'color')).toEqual(color);
	});
});

describeSerial('edit CSS then HTML', () => {
	let indexPage: IndexPage;
	test.beforeAll(({ page, serverFilePath }) => {
		indexPage = new IndexPage(page, '', serverFilePath);
	});

	test("ensure HTML changes don't override CSS changes", async ({
		page,
		serverFilePath,
	}) => {
		await indexPage.goto();

		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(255, 0, 0)',
		);
		await updateCSS(page, 'styles.css', serverFilePath, { background: 'blue' });
		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(0, 0, 255)',
		);
		await indexPage.expectTitle(IndexPage.defaultTitle);
		await IndexPage.update(indexPage, 'My Cool Site');
		await indexPage.expectTitle('My Cool Site');

		// the background color should NOT be reset!
		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(0, 0, 255)',
		);
	});

	test('ensure new CSS changes are applied', async ({
		page,
		serverFilePath,
	}) => {
		await updateCSS(page, 'styles.css', serverFilePath, { background: 'lime' });
		expect(await expectStyle(page, 'backgroundColor')).toEqual(
			'rgb(0, 255, 0)',
		);
	});
});
