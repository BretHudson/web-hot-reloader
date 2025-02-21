import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { type ServerFilePath } from './server-path';
import {
	type GlobalData,
	type SitePagePath,
	type SitePagePathConfig,
	defaultPagePaths,
	replacementsRoot,
	tempDir,
	templateRoot,
} from '../shared';
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
	page: Page;
	constructor(site: Site, attr: string, filePath: string) {
		const selector = `[${attr}^="${filePath.replaceAll('\\', '/')}"]`;
		const { page } = site;
		this.locator = page.locator(selector);
		this.attr = attr;
		this.page = page;
	}
}

export abstract class BasePage {
	static defaultTitle: string;
	static updatedTitle: string;
	static filePath: HTMLFile;

	site: Site;
	page: Page;
	path: string;
	serverFilePath: ServerFilePath;
	curTitle: string;

	constructor(site: Site, path: string) {
		this.site = site;
		this.page = site.page;
		this.path = path;
		this.serverFilePath = site.serverFilePath;

		// TODO(bret): Move this, I don't love it here
		if (fs.existsSync(site.serverFilePath.filePath)) return;
		fs.cpSync(templateRoot, site.serverFilePath.filePath, {
			recursive: true,
		});
	}

	async goto() {
		const url = this.serverFilePath.url + this.path;
		return this.page.goto(url);
	}

	getCSS(fileName: CSSFile) {
		return new WHRLocator(this.site, 'href', `css/${fileName}`);
	}

	getImg(fileName: string) {
		return new WHRLocator(this.site, 'src', fileName);
	}

	getFavicon(fileName: string) {
		return new WHRLocator(this.site, 'href', fileName);
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

	constructor(site: Site, path: string) {
		super(site, 'sub-dir/' + path);
	}
}

export class ReloadableAsset {
	site: Site;
	src: string;
	locator: WHRLocator;
	attr: string;

	constructor(site: Site, src: string, attr: string) {
		this.site = site;
		this.src = src;
		this.attr = attr;
		this.locator = new WHRLocator(site, attr, src);
	}
}

export class ReplaceableAsset extends ReloadableAsset {
	async replace() {
		const a = path.join(replacementsRoot, this.src);
		const b = path.join(this.site.serverFilePath.filePath, this.src);
		await fs.promises.copyFile(a, b);
	}
}

export class CSSAsset extends ReloadableAsset {
	constructor(site: Site, fileName: string) {
		super(site, fileName, 'href');
	}

	async update(options: { background?: string; color?: string }) {
		const fileName = this.src.replace('/', path.sep);
		const cssPath = path.join(this.site.serverFilePath.filePath, fileName);
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
	}
}

export class Site {
	page: Page;
	serverFilePath: ServerFilePath;
	pagePaths: SitePagePathConfig;
	currentPage: SitePagePath;
	globalData: GlobalData;

	constructor(
		page: Page,
		serverFilePath: ServerFilePath,
		globalData: GlobalData,
	) {
		this.page = page;
		this.serverFilePath = serverFilePath;
		this.pagePaths = Object.assign({}, defaultPagePaths);
		this.globalData = globalData;

		// TODO(bret): Move this, I don't love it here
		if (fs.existsSync(serverFilePath.filePath)) return;
		fs.cpSync(templateRoot, serverFilePath.filePath, {
			recursive: true,
		});
	}

	getCSS(fileName: CSSFile) {
		return new CSSAsset(this, `css/${fileName}`);
	}

	getImg(fileName: string) {
		return new ReplaceableAsset(this, fileName, 'src');
	}

	getFavicon(fileName: string) {
		return new ReplaceableAsset(this, fileName, 'href');
	}

	async goto(page: SitePagePath) {
		let url: string | undefined = this.pagePaths[page];
		if (url === undefined) throw new Error('ruh roh');
		this.currentPage = page;
		return this.page.goto(this.serverFilePath.url + url);
	}

	async replaceImage(src: string) {
		const a = path.join(replacementsRoot, src);
		const b = path.join(this.serverFilePath.filePath, src);
		await fs.promises.copyFile(a, b);
	}
}
