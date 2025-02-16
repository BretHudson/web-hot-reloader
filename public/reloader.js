const _origin = window.location.port
	? window.location.origin.replace(`:${window.location.port}`, '')
	: window.location.origin;
const origin = `${_origin}:${3008}`;

const SCRIPT_ID = '__web-hot-reloader';

const queryKey = '_whr';
const getCacheBust = () => `?${queryKey}=${Date.now().toString(36)}`;

let self = document.getElementById(SCRIPT_ID);
window.addEventListener('DOMContentLoaded', () => {
	self = document.getElementById(SCRIPT_ID);
});
const getOrigin = () => self.getAttribute('data-origin');

const updateCSS = (fileName) => {
	console.log('css', { fileName });
	// TODO(bret): At some point, set it up to just update the CSS that it needs to...
	const cssElems = [...document.querySelectorAll(`link`)].filter((link) => {
		// TODO(bret); this check isn't robust
		console.log('test', link.href.split('?')[0], fileName);
		return link.href.split('?')[0].endsWith(fileName);
	});

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
	const names = ['index.html', '.html'];

	const targetPath = window.location.origin + '/' + fileName;
	// TODO(bret): Revisit this
	const valid = names.some((name) => {
		const cur = window.location.origin + window.location.pathname + name;
		return cur === targetPath || cur === targetPath.replace('index.html', '');
	});

	if (!valid) return;

	const stylesheets = [
		...document.querySelectorAll('link[rel="stylesheet"]'),
	].map(({ href }) => href.replace(_origin + '/', ''));
	console.log(stylesheets);
	stylesheets
		.filter((href) => href.includes(queryKey))
		.map((href) => {
			// TODO(bret): Make this robust
			// href.replace(origin, '').replace(_origin, '')
			return href.replace(window.location.href, '');
		})
		.forEach((href) => {
			console.log({ href });
			// TODO(bret): There's gotta be a better way to do this
			// we really need to construct the full URL so we can compare them, unfortuately. '/css/reset.css' vs './reset.css' vs '../reset.css', etc
			// TODO(bret): How to handle ./ ?
			contents = contents.replace(
				'"' + href.split('?')[0] + '"',
				'"' + href + '"',
			);
		});

	const script = document.getElementById('__web-hot-reloader');

	document.open();
	document.write(contents);
	document.close();

	if (!document.getElementById('__web-hot-reloader'))
		document.head.append(script);
};

const reloadSelf = () => {
	const fileName = import.meta.url.split('?')[0];
	console.warn(`Swapped ${fileName}`);
	const newScript = document.createElement('script');
	for (const attr of self.attributes) {
		if (attr.name === 'src') continue;
		newScript.setAttribute(attr.name, attr.value);
	}
	newScript.src = import.meta.url.split('?')[0] + getCacheBust();
	self.after(newScript);
	self.remove();
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
