import fs from 'node:fs';
import path from 'node:path';
import {
	test as baseTest,
	expect as baseExpect,
	type Page,
	Locator,
} from '@playwright/test';

import { tempRoot, SERVER_PORT, tempDir, templateRoot } from './shared';

export interface ServerFilePath {
	path: string;
	url: string;
	filePath: string;
}

export interface Fixtures {
	serverFilePath: ServerFilePath;
}

let count = 0;

const constructServerFilePath = () => {
	const _path = `test-${count++}`;
	const data = {
		path: _path,
		url: `http://localhost:${SERVER_PORT}/${tempDir}/${_path}/`,
		filePath: path.join(tempRoot, _path),
	};

	// if (!fs.existsSync(data.filePath)) {
	// 	fs.cpSync(templateRoot, data.filePath, {
	// 		recursive: true,
	// 	});
	// }

	return data;
};

export * from '@playwright/test';
export const test = baseTest.extend<Fixtures>({
	serverFilePath: [
		async ({}, use) => {
			const data = constructServerFilePath();
			await use(data);
		},
		{ option: true, scope: 'test' },
	],
});

// TODO(bret): Move these
export type CSSFile = 'styles.css' | 'styles2.css' | 'styles3.css';
export type HTMLFile = 'index.html' | 'page-two.html' | 'sub-dir/index.html';

interface WebSocketData {
	eventName: string;
	data: {};
}

// TODO(bret): Find an alternative way to figure out how to detect if a page has loaded (or alternatively, not accepted incoming changes!)
const waitForWebSocketEvent = (page: Page, event: string, fileName: string) => {
	return page.evaluate(
		({ event, fileName }) => {
			return new Promise<WebSocketData>((resolve) => {
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

export abstract class BasePage {
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

export class WHRLocator {
	locator: Locator;
	attr: string;
	page: Page;
	constructor(page: Page, attr: string, filePath: string) {
		const selector = `[${attr}^="${filePath.replaceAll('\\', '/')}"]`;
		this.locator = page.locator(selector);
		this.attr = attr;
		this.page = page;
	}
}

export const expect = baseExpect.extend({
	async WHR_toNotBeReloaded(received: WHRLocator) {
		const { locator, attr } = received;
		await locator.waitFor({ state: 'attached' });
		const link = await locator.getAttribute(attr);
		if (!link) {
			return {
				message: () => `attribute "${attr}" not present on element`,
				pass: false,
			};
		}
		const pass = !link.includes('?');
		return {
			message: () => (pass ? 'passed' : `element has already been reloaded`),
			pass,
		};
	},

	async WHR_toBeReloaded(received: WHRLocator) {
		const { page, locator, attr } = received;
		try {
			await locator.waitFor({ state: 'attached', timeout: 3e3 });
		} catch (e) {
			return {
				message: () => 'element not on page',
				pass: false,
			};
		}
		try {
			const good = await page.waitForFunction(
				(el) => el?.getAttribute(attr)?.includes('?'),
				await locator.elementHandle(),
				{ timeout: 10e3 },
			);

			return {
				message: () => 'passed',
				pass: Boolean(good),
			};
		} catch {
			return {
				message: () => 'element has not been reloaded via WHR',
				pass: true,
			};
		}
	},
});

export const describeSerial = (title: string, callback: () => void) => {
	test.describe(title, async () => {
		let page: Page;

		const serverFilePath = constructServerFilePath();

		test.use({
			serverFilePath: async ({}, use) => {
				return use(serverFilePath);
			},
			page: async ({ browser }, use) => {
				page ??= await browser.newPage();
				return use(page);
			},
		});

		test.describe.configure({ mode: 'serial' });

		test.beforeAll(async ({ browser }) => {
			page ??= await browser.newPage();
		});

		test.afterAll(async () => {
			await page.close();
		});

		callback();
	});
};
