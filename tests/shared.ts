import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootPath = path.join(__dirname, '..');

export const SERVER_PORT = 3030;
export const WHR_PORT = 3040;

export const tempDir = 'temp';
export const siteRoot = path.join(rootPath, 'tests/site');
export const templateRoot = path.join(siteRoot, 'template');
export const tempRoot = path.join(siteRoot, tempDir);
