const fs = require('fs');
const http = require('http');
const md5 = require('md5');
const path = require('path');
const socketio = require('socket.io');

const DEFAULT_PORT = 3008;

const {
	PORT = DEFAULT_PORT,
	NODE_ENV = 'production'
} = process.env;

const [_nodePath, _scriptPath, ...args] = process.argv;

const [watchPath] = args;

const publicPath = path.join(__dirname, '../public');
const server = http.createServer((req, res) => {
	let contentType = 'text/html';
	
	const showError = () => {
		res.writeHead(404, { 'Content-Type': contentType });
		res.end(undefined, 'utf-8');
	};

	const filePath = path.join(publicPath, req.url);
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
const io = socketio(server);

io.on('connection', client => {
	console.log(`connect\t\tid: ${client.id}`);

	client.on('disconnect', () => {
		console.log(`disconnect\tid: ${client.id}`);
	});
});

const sendMessageCSSUpdate = (eventType, fileName) => {
	io.sockets.emit('css-update', { fileName });
	console.log(`${fileName} update emited (eventType: ${eventType})`);
};

const checksumMap = new Map();
const haveFileContentsUpdated = (filePath, fileContents) => {
	const checksum = md5(fileContents);
	if (checksum === checksumMap.get(filePath))
		return false;
	checksumMap.set(filePath, checksum);
	return true;
};

fs.watch(watchPath, (eventType, fileName) => {
	if (fileName?.endsWith('.css')) {
		const filePath = path.join(watchPath, fileName);
		
		fs.readFile(filePath, (err, data) => {
			if (haveFileContentsUpdated(filePath, data) === false) return;
			sendMessageCSSUpdate(eventType, fileName);
		});
	}
});

server.listen(PORT, () => {
	console.log(`Server listening on ${PORT} in ${NODE_ENV}`);
});
