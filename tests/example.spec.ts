import fs from 'fs';
import path from 'path';

import type { Page } from '@playwright/test';

import { test, expect, type ServerFilePath, describeSerial } from './fixtures';
import { tempDir, templateRoot } from './shared';

abstract class BasePage {
	page: Page;
	path: string;
	serverFilePath: ServerFilePath;

	constructor(page: Page, path: string, serverFilePath) {
		this.page = page;
		this.path = path;
		this.serverFilePath = serverFilePath;
	}

	goto() {
		const url = this.serverFilePath.url + this.path;
		console.log({ url });
		return this.page.goto(url);
	}

	async expectTitle(title: string) {
		await expect(this.page).toHaveTitle(title);
	}
}

class IndexPage extends BasePage {
	static defaultTitle = 'My Site';

	static async update(page: BasePage, pageTitle: string) {
		await updateHTML(page, 'index.html', page.serverFilePath, (htmlContents) =>
			htmlContents.replace(IndexPage.defaultTitle, pageTitle),
		);
	}
}

class PageTwoPage extends BasePage {
	static async update(page: BasePage, pageTitle: string) {
		await updateHTML(
			page,
			'page-two.html',
			page.serverFilePath,
			(htmlContents) => htmlContents.replace('Page Two', pageTitle),
		);
	}
}

class SubDirIndexPage extends BasePage {
	constructor(page: Page, path: string, serverFilePath: ServerFilePath) {
		super(page, 'sub-dir/' + path, serverFilePath);
	}

	static async update(page: BasePage, pageTitle: string) {
		await updateHTML(
			page,
			'sub-dir/index.html',
			page.serverFilePath,
			(htmlContents) => htmlContents.replace('A Subdirectory', pageTitle),
		);
	}
}

test.beforeEach(async ({ serverFilePath }) => {
	if (fs.existsSync(serverFilePath.filePath)) return;
	await fs.promises.cp(templateRoot, serverFilePath.filePath, {
		recursive: true,
	});
});

const expectStyle = async (
	page: Page,
	property: Exclude<keyof CSSStyleDeclaration, number | Symbol>,
) => {
	console.log('expect style yo', property);
	const body = page.locator('body');
	const computedStyle = await body.evaluate((b, property) => {
		return window.getComputedStyle(b)[property];
	}, property);
	return computedStyle;
};

const waitForWebSocketEvent = (page: Page, event: string) => {
	return page.evaluate(() => {
		return new Promise<{ eventName: string; data: {} }>((resolve) => {
			const _window = window as typeof window & { '__whr-socket': any };
			_window['__whr-socket'].onAny((eventName, data) => {
				resolve({ eventName, data });
			});
		});
	});
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

	const evaluate = waitForWebSocketEvent(page, 'css-update');

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

	const updateFile = fs.promises.writeFile(cssPath, newContents);

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'css-update',
		data: {
			fileName: `${tempDir}/${serverFilePath.path}/${fileName}`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
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
	const evaluate = waitForWebSocketEvent(page, 'html-update');
	const updateFile = fs.promises.writeFile(htmlPath, replacement(htmlContents));

	const [payload] = await Promise.all([evaluate, updateFile]);

	expect(payload).toMatchObject({
		eventName: 'html-update',
		data: {
			fileName: `${tempDir}/${serverFilePath.path}/${fileName}`,
		},
	});

	// TODO(bret): wait for websocket event
	await new Promise<void>((resolve) => setTimeout(() => resolve(), 1e3));
};

const defaultBGColor = 'rgb(255, 0, 0)';
const defaultColor = 'rgb(255, 255, 255)';

describeSerial('edit CSS', () => {
	let background = defaultBGColor;
	let color = defaultColor;

	test('ensure edits are received', async ({ page, serverFilePath }) => {
		await page.goto(serverFilePath.url);
		console.log('what is happening');
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);

		background = 'rgb(0, 0, 255)';
		await updateCSS(page, 'styles.css', serverFilePath, {
			background,
		});
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);
	});

	test('ensure multiple files are received', async ({
		page,
		serverFilePath,
	}) => {
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);

		color = 'rgb(0, 0, 0)';
		await updateCSS(page, 'styles2.css', serverFilePath, { color });
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);
	});

	test('ensure non-included files are ignored client-side', async ({
		page,
		serverFilePath,
	}) => {
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);

		await updateCSS(page, 'styles3.css', serverFilePath, {
			background: 'magenta',
			color: 'magenta',
		});
		expect(await expectStyle(page, 'backgroundColor')).toEqual(background);
		expect(await expectStyle(page, 'color')).toEqual(color);
	});
});

test.describe('edit index.html', () => {
	['', 'index', 'index.html'].forEach((fileName) => {
		describeSerial(`as "/${fileName}"`, () => {
			let pageTitle = IndexPage.defaultTitle;

			let indexPage: IndexPage;
			test.beforeAll(async ({ page, serverFilePath }) => {
				indexPage = new IndexPage(page, fileName, serverFilePath);
			});

			test('load page', async () => {
				await indexPage.goto();
			});

			test('ensure changes are received', async () => {
				await indexPage.expectTitle(pageTitle);
				pageTitle = 'My Cool Site';
				await IndexPage.update(indexPage, pageTitle);
				await indexPage.expectTitle(pageTitle);
			});

			test('ensure changes to another .html file are not received', async () => {
				await indexPage.expectTitle(pageTitle);
				await PageTwoPage.update(indexPage, 'Page II');
				await indexPage.expectTitle(pageTitle);
			});

			test('ensure changes to another index.html file are not received', async () => {
				await indexPage.expectTitle(pageTitle);
				SubDirIndexPage.update(indexPage, 'A Sub Dir');
				await indexPage.expectTitle(pageTitle);
			});
		});
	});
});

test.describe('edit page-two.html', () => {
	['page-two', 'page-two.html'].forEach((fileName) => {
		describeSerial(`as "/${fileName}"`, () => {
			let pageTitle = 'Page Two';

			let pageTwo: PageTwoPage;
			test.beforeAll(({ page, serverFilePath }) => {
				pageTwo = new PageTwoPage(page, fileName, serverFilePath);
			});

			test('ensure changes are received', async () => {
				await pageTwo.goto();
				await pageTwo.expectTitle(pageTitle);
				pageTitle = 'Page II';
				await PageTwoPage.update(pageTwo, pageTitle);
				await pageTwo.expectTitle(pageTitle);
			});

			test('ensure changes to another .html file are not received', async () => {
				await pageTwo.expectTitle(pageTitle);
				await IndexPage.update(pageTwo, 'My Cool Site');
				await pageTwo.expectTitle(pageTitle);
			});
		});
	});
});

test.describe('edit sub-dir/index.html', () => {
	['', 'index', 'index.html'].forEach((fileName) => {
		describeSerial(`as "/${fileName}"`, () => {
			let pageTitle = 'A Subdirectory';

			let subDirIndexPage: SubDirIndexPage;
			test.beforeAll(({ page, serverFilePath }) => {
				subDirIndexPage = new SubDirIndexPage(page, fileName, serverFilePath);
			});

			test('ensure changes are received', async () => {
				await subDirIndexPage.goto();
				await subDirIndexPage.expectTitle(pageTitle);
				pageTitle = 'A Sub Dir';
				await SubDirIndexPage.update(subDirIndexPage, pageTitle);
				await subDirIndexPage.expectTitle(pageTitle);
			});

			test('ensure changes to another .html file are not received', async () => {
				await subDirIndexPage.expectTitle(pageTitle);
				await PageTwoPage.update(subDirIndexPage, 'Page II');
				await subDirIndexPage.expectTitle(pageTitle);
			});

			test('ensure changes to another index.html file are not received', async () => {
				await subDirIndexPage.expectTitle(pageTitle);
				await IndexPage.update(subDirIndexPage, 'My Cool Site');
				await subDirIndexPage.expectTitle(pageTitle);
			});
		});
	});
});

// TODO(bret): Make sure only the HTML page that is currently loaded refreshes!!

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
