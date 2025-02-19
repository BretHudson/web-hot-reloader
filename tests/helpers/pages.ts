import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { type ServerFilePath } from './server-path';
import { tempDir, templateRoot } from '../shared';
import { expect } from '../fixtures/fixtures';

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

	getCSS(fileName: CSSFile) {
		return new WHRLocator(this, 'href', `css/${fileName}`);
	}

	getImg(fileName: string) {
		return new WHRLocator(this, 'src', fileName);
	}

	getFavicon(fileName: string) {
		return new WHRLocator(this, 'href', fileName);
	}

	static async update(page: BasePage, pageTitle: string = this.updatedTitle) {
		let isSamePage = page instanceof this;

		const titleToReplace = isSamePage ? page.curTitle : this.defaultTitle;

		await expect(page).toHaveTitle(page.curTitle);
		await updateHTML(page, this.filePath, page.serverFilePath, (htmlContents) =>
			htmlContents.replace(titleToReplace, pageTitle),
		);
		if (isSamePage) {
			page.curTitle = pageTitle;
		}
		await expect(page).toHaveTitle(isSamePage ? pageTitle : page.curTitle);
	}
}

export class WHRLocator {
	locator: Locator;
	attr: string;
	basePage: BasePage;
	page: Page;
	constructor(basePage: BasePage, attr: string, filePath: string) {
		const selector = `[${attr}^="${filePath.replaceAll('\\', '/')}"]`;
		const { page } = basePage;
		this.locator = page.locator(selector);
		this.basePage = basePage;
		this.attr = attr;
		this.page = page;
	}
}
