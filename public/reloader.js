const _origin = window.location.port
	? window.location.origin.replace(`:${window.location.port}`, '')
	: window.location.origin;
const origin = `${_origin}:${3008}`;

const SCRIPT_ID = '__web-hot-reloader';

const queryKey = '_whr';
const getCacheBust = () => `?${queryKey}=${Date.now().toString(36)}`;

const updateCSS = (fileName) => {
	// TODO(bret): At some point, set it up to just update the CSS that it needs to...
	const cssElems = [...document.querySelectorAll(`link`)].filter((link) =>
		link.href.endsWith(fileName),
	);

	const [cssElem] = cssElems;

	const newCSS = document.createElement('link');
	newCSS.rel = cssElem.rel;
	newCSS.integrity = cssElem.integrity;
	newCSS.type = cssElem.type;
	newCSS.href = cssElem.href.split('?')[0] + getCacheBust();
	newCSS.onload = () => {
		[...cssElems].forEach((cssElem) => cssElem.remove());
	};
	document.head.appendChild(newCSS);
};

const updateHTML = (fileName, contents) => {
	document.open();
	document.write(contents);
	document.close();
};

const reloadSelf = () => {
	const fileName = import.meta.url.split('?')[0];
	console.warn(`Swapped ${fileName}`);
	const script = document.getElementById(SCRIPT_ID);
	const newScript = document.createElement('script');
	for (const attr of script.attributes) {
		if (attr.name === 'src') continue;
		newScript.setAttribute(attr.name, attr.value);
	}
	newScript.src = import.meta.url.split('?')[0] + getCacheBust();
	script.after(newScript);
	script.remove();
};

let lastJsUpdate = null;
const initWebsocket = () => {
	const socket = io(origin);
	window['__whr-socket'] = socket;

	socket.on('connect', () => {
		console.log('Socket connected');
	});

	socket.on('css-update', (data) => {
		const { fileName } = data;
		updateCSS(fileName);
	});

	socket.on('html-update', (data) => {
		const { fileName, contents } = data;
		updateHTML(fileName, contents);
	});

	socket.on('reload-self', (data) => {
		if (lastJsUpdate && lastJsUpdate !== data.lastJsUpdate) {
			console.log('Unloading hot loader, about to disconnect');
			socket.close();
			reloadSelf();
		}
		({ lastJsUpdate } = data);
	});

	socket.on('disconnect', () => {
		console.log('Socket disconnected');
	});

	console.log('Websocket initialized');
};

const init = () => {
	const scriptSrc = `${origin}/socket.io/socket.io.js`;
	const scriptElem = document.createElement('script');
	scriptElem.onload = (e) => {
		initWebsocket();
	};
	scriptElem.src = scriptSrc;
	document.head.append(scriptElem);

	console.log('Hot loader initialized');
};

init();
