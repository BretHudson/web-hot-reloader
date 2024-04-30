const _origin = window.location.port
	? window.location.origin.replace(`:${window.location.port}`)
	: window.location.origin;
const origin = `${_origin}:${3008}`;

const updateCSS = fileName => {
	// TODO(bret): At some point, set it up to just update the CSS that it needs to...
	const cssElems = document.querySelectorAll(`link[href*="${fileName}"]`);
	const random = Math.floor(Math.random() * 1000000);
	
	const [cssElem] = cssElems;
	
	const newCSS = document.createElement('link');
	newCSS.rel = cssElem.rel;
	newCSS.integrity = cssElem.integrity;
	newCSS.type = cssElem.type;
	newCSS.href = cssElem.href.split('?')[0] + '?' + random;
	newCSS.onload = () => {
		[...cssElems].forEach(cssElem => cssElem.remove());
	};
	document.head.appendChild(newCSS);
};

const initWebsocket = () => {
	const socket = io(origin);
	
	socket.on('connect', () => {
		console.log('Socket connected');
	});
	
	socket.on('css-update', data => {
		const { fileName } = data;
		updateCSS(fileName);
	});
	
	socket.on('disconnect', () => {
		console.log('Socket disconnected');
	});
	
	console.log('Websocket initialized');
};

const init = () => {
	const scriptSrc = `${origin}/socket.io/socket.io.js`;
	const scriptElem = document.createElement('script');
	scriptElem.onload = e => {
		initWebsocket();
	};
	scriptElem.src = scriptSrc;
	document.head.append(scriptElem);
	
	console.log('Hot loader initialized');
};

init();
