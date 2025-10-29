import crypto from 'node:crypto';
import url from 'node:url';

export const getDirname = (meta) => url.fileURLToPath(new URL('.', meta.url));

const checksumMap = new Map();
export const haveFileContentsUpdated = (filePath, fileContents) => {
	const checksum =
		fileContents &&
		crypto.createHash('sha256').update(fileContents, 'utf-8').digest('hex');
	if (checksum === checksumMap.get(filePath)) return false;
	checksumMap.set(filePath, checksum);
	return true;
};

export const retry = async (callback) => {
	let error;
	for (let i = 0; i < 5; ++i) {
		try {
			await callback();
			return;
		} catch (e) {
			error = e;
			console.warn('Retrying...');
			await new Promise((resolve) => setTimeout(resolve, 200));
		}
	}
	throw error;
};
