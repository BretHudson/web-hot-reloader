import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { type ServerFilePath } from './server-path';
import { replacementsRoot, tempDir, templateRoot } from '../shared';
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

		await expect(page).toHavePageTitle(page.curTitle);
		await updateHTML(page, this.filePath, page.serverFilePath, (htmlContents) =>
			htmlContents.replace(titleToReplace, pageTitle),
		);
		if (isSamePage) {
			page.curTitle = pageTitle;
		}
		await expect(page).toHavePageTitle(isSamePage ? pageTitle : page.curTitle);
	}
}

export class IndexPage extends BasePage {
	static defaultTitle = 'My Site';
	static updatedTitle = 'My Cool Site';
	static filePath: HTMLFile = 'index.html';
	curTitle = IndexPage.defaultTitle;
}

export class PageTwoPage extends BasePage {
	static defaultTitle = 'Page Two';
	static updatedTitle = 'Page II';
	static filePath: HTMLFile = 'page-two.html';
	curTitle = PageTwoPage.defaultTitle;
}

export class SubDirIndexPage extends BasePage {
	static defaultTitle = 'A Subdirectory';
	static updatedTitle = 'A Sub Dir';
	static filePath: HTMLFile = 'sub-dir/index.html';
	curTitle = SubDirIndexPage.defaultTitle;

	constructor(page: Page, path: string, serverFilePath: ServerFilePath) {
		super(page, 'sub-dir/' + path, serverFilePath);
	}
}

type SitePageName = 'index' | 'page-two' | 'sub-dir/index';

export abstract class ReplaceableAsset {
	site: Site;
	src: string;
	locator: WHRLocator;

	constructor(site: Site, src: string) {
		this.site = site;
		this.src = src;
		const tempPage = new IndexPage(site.page, '', site.serverFilePath);
		this.locator = new WHRLocator(tempPage, 'src', src);
	}

	async replace() {
		const a = path.join(replacementsRoot, this.src);
		const b = path.join(this.site.serverFilePath.filePath, this.src);
		await fs.promises.copyFile(a, b);
	}
}

export class Image extends ReplaceableAsset {}

export class Site {
	page: Page;
	serverFilePath: ServerFilePath;

	constructor(page: Page, serverFilePath: ServerFilePath) {
		this.page = page;
		this.serverFilePath = serverFilePath;

		// TODO(bret): Move this, I don't love it here
		if (fs.existsSync(serverFilePath.filePath)) return;
		fs.cpSync(templateRoot, serverFilePath.filePath, {
			recursive: true,
		});
	}

	getCSS(fileName: CSSFile) {
		const tempPage = new IndexPage(this.page, '', this.serverFilePath);
		return new WHRLocator(tempPage, 'href', `css/${fileName}`);
	}

	getImg(fileName: string) {
		return new Image(this, fileName);
	}

	getFavicon(fileName: string) {
		const tempPage = new IndexPage(this.page, '', this.serverFilePath);
		return new WHRLocator(tempPage, 'href', fileName);
	}

	async goto(page: SitePageName) {
		let url: string | null = null;
		switch (page) {
			case 'index':
				url = '';
				break;
			case 'page-two':
				url = 'page-two';
				break;
			case 'sub-dir/index':
				url = 'sub-dir/';
				break;
		}
		if (url === null) throw new Error('ruh roh');
		return this.page.goto(this.serverFilePath.url + url);
	}

	async replaceImage(src: string) {
		const a = path.join(replacementsRoot, src);
		const b = path.join(this.serverFilePath.filePath, src);
		await fs.promises.copyFile(a, b);
	}
}
