import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootPath = path.join(__dirname, '..');

export const SERVER_PORT = 3030;
export const WHR_PORT = 3040;

export const siteRootDir = 'tests/site';
export const tempDir = 'temp';
export const siteRoot = path.join(rootPath, siteRootDir);
export const replacementsRoot = path.join(siteRoot, '_replacements');
export const templateRoot = path.join(siteRoot, '_template');
export const tempRoot = path.join(siteRoot, tempDir);

export interface SitePagePathConfig {
	'index.html': string;
	'page-two.html': string;
	'sub-dir/index.html': string;
}
export type SitePagePath = keyof SitePagePathConfig;

export interface PageData {
	urlPath: string;
	html: string;
	defaultTitle: string;
}

export interface GlobalData {
	pages: Record<SitePagePath, PageData>;
}

// TODO(bret): Might be good to have these be the source of truth for the filesystem, too
export const defaultPagePaths: SitePagePathConfig = {
	'index.html': '',
	'page-two.html': 'page-two',
	'sub-dir/index.html': 'sub-dir',
} as const;

export const pagePaths = Object.keys(defaultPagePaths) as SitePagePath[];
