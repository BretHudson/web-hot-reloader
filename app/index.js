const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const { debounce } = require('throttle-debounce');

const {
	PORT = 3008,
	NODE_ENV = 'production'
} = process.env;

const [_nodePath, _scriptPath, ...args] = process.argv;

const [watchPath] = args;

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

let _client;
io.on('connection', client => {
	console.log('connect');
	
	_client = client;
	
	client.on('event', data => {
		console.log('event');
	});

	client.on('disconnect', () => {
		console.log('disconnect');
	});
});

const sendMessageCSSUpdate = debounce(1000, false, (eventType, filename) => {
	io.sockets.emit('css-update', { filename });
	console.log(`sent message for ${filename} (${eventType})`);
});

fs.watch(watchPath, (eventType, filename) => {
	if (filename.endsWith('.css')) {
		sendMessageCSSUpdate(eventType, filename);
	}
});

server.listen(PORT, () => {
	console.log(`Server listening on ${PORT} in ${NODE_ENV}`);
});
