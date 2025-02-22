import fs from 'node:fs';
import path from 'node:path';

import { expect } from '../fixtures/fixtures';
import { type Locator, type Page } from '@playwright/test';

import { type ServerFilePath } from './server-path';
import type {
	CSSFile,
	GlobalData,
	PageData,
	SitePagePath,
	SitePagePathConfig,
} from '../shared';
import {
	defaultPagePaths,
	pagePaths,
	replacementsRoot,
	tempDir,
	templateRoot,
} from '../shared';

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
	page: Page,
	fileName: SitePagePath,
	serverFilePath: ServerFilePath,
	replacement: (str: string) => string,
) => {
	const htmlPath = path.join(serverFilePath.filePath, fileName);
	const htmlContents = await fs.promises.readFile(htmlPath, 'utf-8');

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

class SitePage {
	site: Site;
	page: Page;
	pageData: PageData;
	urlPath: string;
	defaultTitle: string;
	currentTitle: string;

	constructor(pageData: PageData, site: Site, page: Page) {
		this.pageData = pageData;
		this.site = site;
		this.page = page;
		this.defaultTitle = pageData.defaultTitle;
		this.currentTitle = pageData.defaultTitle;
	}

	async update(newTitle: string) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		await updateHTML(
			this.page,
			// TODO(bret): remove as
			this.pageData.urlPath as SitePagePath,
			this.site.serverFilePath,
			(htmlContents) => htmlContents.replace(this.currentTitle, newTitle),
		);
		this.currentTitle = newTitle;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
}

export class Site {
	page: Page;
	pages: Record<SitePagePath, SitePage>;
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

		this.pages = Object.fromEntries(
			pagePaths.map((urlPath) => {
				const pageData = globalData.pages[urlPath];
				return [urlPath, new SitePage(pageData, this, page)];
			}),
		) as typeof this.pages;

		// TODO(bret): Move this, I don't love it here
		if (fs.existsSync(serverFilePath.filePath)) return;
		fs.cpSync(templateRoot, serverFilePath.filePath, {
			recursive: true,
		});
	}

	async updateHTML(urlPath: SitePagePath, newTitle: string) {
		await this.pages[urlPath].update(newTitle);
	}

	setPagePathAlias(urlPath: SitePagePath, alias: string) {
		this.pagePaths[urlPath] = alias;
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
