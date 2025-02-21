const _origin = window.location.port
	? window.location.origin.replace(`:${window.location.port}`, '')
	: window.location.origin;
const origin = `${_origin}:${3008}`;

const SCRIPT_ID = '__web-hot-reloader';

const log = console.log.bind(this, '[WHR]');
const warn = console.warn.bind(this, '[WHR]');
const error = console.error.bind(this, '[WHR]');

// TODO(bret): Ensure any query params on the src/href attributes are preserved
// NOTE(bret): It will always be /?_whr=[..]$/ or /&_whr=[..]$/
const queryKey = '_whr';
const getCacheBust = () => `${queryKey}=${Date.now().toString(36)}`;

let self = document.getElementById(SCRIPT_ID);
window.addEventListener('DOMContentLoaded', () => {
	self = document.getElementById(SCRIPT_ID);
});
const getOrigin = () => self.getAttribute('data-origin');

const removeAllQueryStrings = (url) => url.split('?')[0];
const removeCacheBust = (url) => removeAllQueryStrings(url);
const addCacheBust = (url) => removeCacheBust(url) + '?' + getCacheBust();

/// NOTE(bret): there is a difference between accessing via square brackets & getAttribute()
// For example, given <img src="logo.svg" />
// - link.src/link['src'] will return the computed property, ie "http://localhost/logo.svg"
// - link.getAttribute('src') will return "logo.svg"

const updateElems = (fileName, query, attr) => {
	// TODO(bret); this check isn't robust
	const elems = [...document.querySelectorAll(query)].filter((link) => {
		return removeAllQueryStrings(link[attr]).endsWith(fileName);
	});

	elems.forEach((elem) => {
		const value = addCacheBust(elem.getAttribute(attr));
		elem.setAttribute(attr, value);
	});
};

const updateCSS = (fileName) => {
	updateElems(fileName, `link`, 'href');
};

const updateHTML = (fileName, _contents) => {
	const names = ['.html', 'index.html', '/index.html'];

	let contents = _contents;

	// TODO(bret): Revisit this
	const targetPath = window.location.origin + '/' + fileName;
	const valid = names.some((name) => {
		const cur = window.location.origin + window.location.pathname + name;
		return cur === targetPath || cur === targetPath.replace('index.html', '');
	});

	if (!valid) {
		log('do not update');
		return;
	}

	warn('updating!');
	const script = document.getElementById('__web-hot-reloader');

	// TODO(bret): Revisit this - string replacement is highly dependent on how the incoming HTML file is formatted :/
	['src', 'href'].forEach((attr) => {
		const elems = [...document.querySelectorAll(`[${attr}*="${queryKey}="]`)];
		elems.forEach((elem) => {
			const link = elem.getAttribute(attr);
			const filePath = removeCacheBust(link);
			contents = contents.replaceAll(`"${filePath}"`, `"${link}"`);
		});
	});

	document.open();
	document.write(contents);
	document.close();

	if (!document.getElementById('__web-hot-reloader'))
		document.head.append(script);
};

// TODO(bret): Figure out all the places an image could be used
const updateImage = (fileName) => {
	updateElems(fileName, `img`, 'src');
	updateElems(fileName, `link`, 'href'); // shortcut icon

	// TODO(bret): Gonna need a special flag or something for urls
	// og:image / etc
};

const reloadSelf = () => {
	const fileName = removeAllQueryStrings(import.meta.url);
	warn(`Swapped ${fileName}`);
	const newScript = document.createElement('script');
	for (const attr of self.attributes) {
		if (attr.name === 'src') continue;
		newScript.setAttribute(attr.name, attr.value);
	}
	newScript.src = addCacheBust(fileName);
	self.after(newScript);
	self.remove();
};

let lastJsUpdate = null;
const initWebsocket = () => {
	const socket = io(origin);
	window['__whr-socket'] = socket;

	socket.on('connect', () => {
		log('Socket connected');
	});

	socket.on('css-update', (data) => {
		const { fileName } = data;
		updateCSS(fileName);
	});

	socket.on('html-update', (data) => {
		const { fileName, contents } = data;
		updateHTML(fileName, contents);
	});

	socket.on('image-update', (data) => {
		const { fileName } = data;
		updateImage(fileName);
	});

	socket.on('reload-self', (data) => {
		if (lastJsUpdate && lastJsUpdate !== data.lastJsUpdate) {
			log('Unloading hot loader, about to disconnect');
			socket.close();
			reloadSelf();
		}
		({ lastJsUpdate } = data);
	});

	socket.on('disconnect', () => {
		log('Socket disconnected');
	});

	log('Websocket initialized');
};

const init = () => {
	const scriptSrc = `${origin}/socket.io/socket.io.js`;
	const scriptElem = document.createElement('script');
	scriptElem.onload = () => initWebsocket();
	scriptElem.src = scriptSrc;
	document.head.append(scriptElem);

	log('Hot loader initialized');
};

init();
