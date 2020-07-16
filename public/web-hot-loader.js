const updateCSS = filename => {
	// TODO(bret): At some point, set it up to just update the CSS that it needs to...
	const cssElem = document.querySelector(`link[href*="${filename}"]`);
	const random = Math.floor(Math.random() * 1000000);
	
	const newCSS = document.createElement('link');
	newCSS.rel = cssElem.rel;
	newCSS.integrity = cssElem.integrity;
	newCSS.type = cssElem.type;
	newCSS.href = cssElem.href.split('?')[0] + '?' + random;
	newCSS.onload = () => {
		cssElem.remove();
	};
	document.head.appendChild(newCSS);
};

const initWebsocket = () => {
	const socket = io('http://localhost:3008');
	
	socket.on('connect', () => {
		console.log('Socket connected');
	});
	
	socket.on('css-update', data => {
		const { filename } = data;
		updateCSS(filename);
	});
	
	socket.on('disconnect', () => {
		console.log('Socket disconnected');
	});
	
	console.log('Websocket initialized');
};

const init = () => {
	const scriptSrc = 'http://localhost:3008/socket.io/socket.io.js';
	const scriptElem = document.createElement('script');
	scriptElem.onload = e => {
		initWebsocket();
	};
	scriptElem.src = scriptSrc;
	document.head.append(scriptElem);
	
	console.log('Hot loader initialized');
};

init();