import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Server } from 'socket.io';
import { instrument } from '@socket.io/admin-ui';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_PORT = 3008;

const { PORT = DEFAULT_PORT, NODE_ENV = 'production' } = process.env;

console.log('Starting Web Hot Reloader');
console.log('Options: ' + JSON.stringify({ PORT, NODE_ENV }));

const [_nodePath, _scriptPath, ...args] = process.argv;

const [_watchPath] = args;
const watchPath = path.join(_watchPath);

const publicPath = path.join(__dirname, '../public');
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
			const content = data.replace(DEFAULT_PORT, PORT);
			res.end(content, 'utf-8');
		});
	} else {
		showError();
	}
});

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

let lastJsUpdate = Date.now();
io.on('connection', (client) => {
	const { origin: clientOrigin, pathName, assets } = client.handshake.query;

	// TODO(bret): What about .php? or other files?
	const paths = [
		[watchPath, pathName + '.html'],
		[watchPath, pathName, 'index.html'],
		[watchPath, pathName],
	].map((u) => path.join(...u));

	const found = paths.find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
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

// pulled from https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types#image_file_type_details
const imageExtensions = [
	// APNG
	'.apng',
	// AVIF
	'.avif',
	// BMP
	'.bmp',
	// GIF
	'.gif',
	// ICO
	'.ico',
	// JPEG
	'.jpg',
	'.jpeg',
	'.jpe',
	'.jif',
	'.jfif',
	// PNG
	'.png',
	// SVG
	'.svg',
	// TIFF
	'.tif',
	'.tiff',
	// WebP
	'.webp',
];

const fileToEventMap = {
	'.css': 'css-update',
	'.html': 'html-update',
	...Object.fromEntries(imageExtensions.map((e) => [e, 'image-update'])),
};

const supportedFileExt = Object.keys(fileToEventMap);

const sendUpdate = (eventType, fileName, contents) => {
	const ext = path.extname(fileName);
	const event = fileToEventMap[ext];
	if (!event) return;
	const room = path.join(fileName);
	io.sockets.to(room).emit(event, { fileName, contents });
	console.log(
		`[${event}] ${fileName} update emitted to room "${room}" (eventType: ${eventType})`,
	);
};

const checksumMap = new Map();
const haveFileContentsUpdated = (filePath, fileContents) => {
	const checksum =
		fileContents &&
		crypto.createHash('sha256').update(fileContents, 'utf-8').digest('hex');
	if (checksum === checksumMap.get(filePath)) return false;
	checksumMap.set(filePath, checksum);
	return true;
};

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

const retry = async (callback) => {
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

// TODO(bret): Do not commit recursive!!!
fs.watch(watchPath, { recursive: true }, async (eventType, fileName) => {
	if (!fileName) return;
	if (eventType === 'rename') return;

	if (!supportedFileExt.includes(path.extname(fileName))) return;

	const filePath = path.join(watchPath, fileName);
	if (!fs.existsSync(filePath)) return;

	await retry(async () => {
		const stats = await fs.promises.stat(filePath);
		if (!stats.isFile()) return;
	});

	await retry(async () => {
		fileName = fileName.replaceAll(path.sep, '/');
		const contents = await fs.promises.readFile(filePath, 'utf-8');
		if (haveFileContentsUpdated(filePath, contents) === false) return;
		sendUpdate(eventType, fileName, contents);
	});
});
const shutdown = () => server.close(() => process.exit(0));

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

server.listen(PORT, () => {
	console.log('Web Hot Reloader started successfully');
});
