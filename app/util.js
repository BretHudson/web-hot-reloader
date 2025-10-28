import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const getFileMeta = (meta) => {
	const __filename = fileURLToPath(meta.url);
	const __dirname = path.dirname(__filename);
	// TODO(bret): try this as well
	// const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
	return { __filename, __dirname };
};
