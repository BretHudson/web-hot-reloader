import path from 'node:path';

import { tempRoot, SERVER_PORT, tempDir } from '../shared';

let count = 0;

export interface ServerFilePath {
	path: string;
	url: string;
	filePath: string;
}

export const constructServerFilePath = (): ServerFilePath => {
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
