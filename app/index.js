import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { default as ignore } from 'ignore';
import { instrument } from '@socket.io/admin-ui';
import { Server } from 'socket.io';

import { DEFAULT_PORT, NODE_ENV, imageExtensions } from './constants.js';
import { getDirname, haveFileContentsUpdated, retry } from './util.js';

const __dirname = getDirname(import.meta);
const publicPath = path.join(__dirname, '../public');

const pathsToIgnore = [
	'.git',
	'.log',
	'.nyc_output',
	'.sass-cache',
	'.yarn',
	'bower_components',
	'coverage',
	'node_modules',
];

const fileToEventMap = {
	'.html': 'html-update',
	'.css': 'asset-update',
	...Object.fromEntries(imageExtensions.map((e) => [e, 'asset-update'])),
};

const supportedFileExt = Object.keys(fileToEventMap);

const defaultOptions = {
	watchPath: '.',
	port: DEFAULT_PORT,
};

export class WebHotReloader {
	dirIgnoreMap = new Map();
	dirGitignoreMap = new Map();

	constructor(options) {
		this.options = { ...options };
		this.options.watchPath ??= defaultOptions.watchPath;
		this.options.port ??= defaultOptions.port;

		this.options.watchPath = path.join(this.options.watchPath);

		this.scanForGitignore('');
	}

	registerGitignore(curPath) {
		const { dirIgnoreMap, dirGitignoreMap } = this;
		const { watchPath } = this.options;

		const dirPath = path.join(watchPath, path.relative(watchPath, curPath));
		const filePath = path.join(dirPath, '.gitignore');

		const key = this.#getKeyFromPath(dirPath);
		if (dirIgnoreMap.has(key)) return;

		let content = null;
		const ig = ignore();
		if (fs.existsSync(filePath)) {
			const fileContent = fs.readFileSync(filePath, 'utf-8');
			content = [...pathsToIgnore, fileContent].join('\n');
			ig.add(content);
		}
		dirIgnoreMap.set(key, ig);
		dirGitignoreMap.set(key, content);
		return Boolean(content);
	}

	scanForGitignore(dir) {
		const { watchPath } = this.options;

		const dirPath = path.join(watchPath, dir);

		if (this.registerGitignore(dirPath)) {
			console.log(
				`\tParsed "${path.join(
					path.relative(watchPath, dirPath),
					'.gitignore',
				)}"`,
			);
		}

		const entries = fs.readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === '.gitignore') continue;

			const parentPath = path.relative(watchPath, entry.parentPath);
			const filePath = path.join(parentPath, entry.name);
			if (this.ignores(path.join(watchPath, filePath))) continue;

			if (!entry.isFile()) this.scanForGitignore(filePath);
		}
	}

	#getKeyFromPath(curPath) {
		const { watchPath } = this.options;
		const dirPath = path.join(watchPath, path.relative(watchPath, curPath));
		return path.relative(watchPath, dirPath);
	}

	start() {
		console.log(`Starting Web Hot Reloader in "${NODE_ENV}"`);

		const { watchPath, port } = this.options;
		console.log('Options: ' + JSON.stringify({ watchPath, port }));

		const server = http.createServer((req, res) => {
			res.setHeader('Access-Control-Allow-Origin', '*');

			let contentType = 'text/html';

			const showError = () => {
				res.writeHead(404, { 'Content-Type': contentType });
				res.end(undefined, 'utf-8');
			};

			const filePath = path.join(publicPath, req.url).split('?')[0];
			if (fs.existsSync(filePath)) {
				contentType = 'text/javascript';
				fs.readFile(filePath, 'utf8', (err, data) => {
					if (err) return showError();
					res.writeHead(200, { 'Content-Type': contentType });
					const content = data.replace(DEFAULT_PORT, this.options.port);
					res.end(content, 'utf-8');
				});
			} else {
				showError();
			}
		});

		const shutdown = () => server.close(() => process.exit(0));
		process.on('SIGINT', () => shutdown());
		process.on('SIGTERM', () => shutdown());

		this.server = server;

		const adminOrigin = 'https://admin.socket.io';
		const io = new Server(server, {
			cors: (req, callback) => {
				let origin = '*';
				if (req.headers.origin === adminOrigin) origin = [adminOrigin];
				callback(null, {
					origin,
					credentials: true,
				});
			},
		});

		instrument(io, { auth: false });

		this.io = io;

		// for dev only
		const clientJsPath = path.join(publicPath, 'reloader.js');
		fs.watchFile(clientJsPath, { interval: 1000 }, () => {
			console.log('js updated');
			fs.readFile(clientJsPath, (err, data) => {
				if (haveFileContentsUpdated(clientJsPath, data) === false) return;
				lastJsUpdate = Date.now();
				io.sockets.emit('reload-self', { lastJsUpdate });
			});
		});

		let lastJsUpdate = Date.now();
		io.on('connection', (client) => {
			const { origin: clientOrigin, pathName } = client.handshake.query;

			// TODO(bret): What about .php? or other files?
			const paths = [
				[watchPath, pathName + '.html'],
				[watchPath, pathName, 'index.html'],
				[watchPath, pathName],
			].map((u) => path.join(...u));

			const found = paths.find(
				(p) => fs.existsSync(p) && fs.statSync(p).isFile(),
			);
			if (!found) throw new Error('???', pathName);

			const room = path.relative(watchPath, found);
			client.join(room);

			console.log(`connect\t\tid: ${client.id}\troom: ${room}`);

			client.emit('reload-self', { lastJsUpdate });

			client.on('watch-asset', (json) => {
				const data = JSON.parse(json);
				const room = path.join(data.room);
				client.join(room);
			});

			client.on('disconnect', () => {
				console.log(`disconnect\tid: ${client.id}\troom: ${room}`);
			});
		});

		fs.watch(watchPath, { recursive: true }, async (eventType, fileName) => {
			if (!fileName) return;
			if (eventType === 'rename') return;

			if (!supportedFileExt.includes(path.extname(fileName))) return;

			const filePath = path.join(watchPath, fileName);
			if (this.ignores(filePath)) return;

			if (!fs.existsSync(filePath)) return;

			await retry(async () => {
				const stats = await fs.promises.stat(filePath);
				if (!stats.isFile()) return;
			});

			await retry(async () => {
				fileName = fileName.replaceAll(path.sep, '/');
				const contents = await fs.promises.readFile(filePath, 'utf-8');
				if (haveFileContentsUpdated(filePath, contents) === false) return;
				this.sendUpdate(eventType, fileName, contents);
			});
		});

		server.listen(this.options.port, () => {
			console.log('Web Hot Reloader started successfully');
		});
	}

	ignores(_filePath) {
		const { dirIgnoreMap } = this;
		const { watchPath } = this.options;

		const filePath = path.join(watchPath, path.relative(watchPath, _filePath));

		const dirPath = path.dirname(filePath);
		const baseName = path.basename(filePath);
		const key = this.#getKeyFromPath(dirPath + path.sep);

		if (key === '') {
			const ig = dirIgnoreMap.get(key);
			const result = ig?.ignores(baseName) ?? false;
			return result;
		} else {
			const dirs = [''].concat(key.split(path.sep));
			for (let d = 0; d < dirs.length - 1; ++d) {
				const ig = dirIgnoreMap.get(dirs[d]);
				if (ig?.ignores(dirs[d + 1])) return true;
			}
			const ig = dirIgnoreMap.get(dirs.at(-1));
			if (ig?.ignores(baseName)) return true;
		}

		return false;
	}

	sendUpdate(eventType, fileName, contents) {
		const ext = path.extname(fileName);
		let event = fileToEventMap[ext];
		if (!event) return;
		const room = path.join(fileName);
		this.io.sockets.to(room).emit(event, { fileName, contents });
		console.log(
			`[${event}] ${fileName} update emitted to room "${room}" (eventType: ${eventType})`,
		);
	}
}
