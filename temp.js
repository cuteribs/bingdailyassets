const axios = require('axios');
const { exit } = require('process');
const { PassThrough } = require('stream');
const { URLSearchParams } = require('url');
const fs = require('fs');

const IMAGE_FOLDER = 'wallpapers';
const TMB_FOLDER = 'thumbnails';
const INDEX_FILE = 'index.json';
const API_URL = 'https://www.bing.com/HPImageArchive.aspx?pid=hp&format=js&n=8&setmkt=en-us&setlang=en-us&ensearch=1';

const TOKEN = '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';
const REPO_NAME = 'cuteribs/bingdaily';
const IMAGE_ON = true;
const TMB_ON = true;
const SERVER_J = process.env.SERVER_J;
const BARK = process.env.BARK;

fs.writeFileSync('error.log', '');

async function getBingDailyList() {
	let records = [];
	let sha = null;
	let result = await getContent(INDEX_FILE);

	if (result.data.sha && result.data.content) {
		records = JSON.parse(Buffer.from(result.data.content, 'base64').toString());
		sha = result.data.sha;
	}

	const newRecords = [];
	let json;

	if (process.argv.length >= 3) {
		json = require(process.argv[2]);
	} else {
		const res = await request(API_URL);
		json = res.data;
	}

	console.log('data', json.images.length);

	for (const image of json.images) {
		const info = {
			date: `${image.startdate.slice(0, 4)}-${image.startdate.slice(4, 6)}-${image.startdate.slice(6, 8)}`,
			fileName: `${image.urlbase.slice(7)}_UHD.jpg`,
			title: image.title,
			desc: image.desc,
			copyright: image.copyright
		};

		try {
			await downloadImage(info);
		} catch (err) {
			logError(err);
		}

		if (!records.find((r) => r.fileName == info.fileName)) {
			records.push(info);
			newRecords.push(info);
		}
	}

	if (newRecords.length > 0) {
		const str = JSON.stringify(records, null, '\t');
		const content = Buffer.from(str).toString('base64');
		result = await uploadContent(INDEX_FILE, content, sha);

		if (result.status == 200) {
			await sendNotification(newRecords);
		} else {
			logError(result.message);
		}
	}
}

function logError(err) {
	if(err && err.config && err.config.data) delete err.config.data;
	fs.appendFileSync('error.log', JSON.stringify(err));
}

async function downloadImage(info) {
	if (IMAGE_ON) {
		const path = `${IMAGE_FOLDER}/${info.fileName}`;
		let result = await getContent(path);

		if (result.status == 404) {
			const url = `https://www.bing.com/th?id=${info.fileName}`;
			const res = await request(url, { responseType: 'stream' });
			const chunks = res.data.pipe(new PassThrough({ encoding: 'base64' }));

			let content = '';
			for await (const chunk of chunks) content += chunk;
			result = await uploadContent(path, content);

			if (result.status === 201) {
				console.log(`🖼 image downloaded: ${path} 🖼`);
			} else {
				logError(result.message);
			}
		}
	}

	if (TMB_ON) {
		const path = `${TMB_FOLDER}/${info.fileName}`;
		let result = await getContent(path);

		if (result.status == 404) {
			const url = `https://www.bing.com/th?id=${info.fileName}&w=400&h=225`;
			const res = await request(url, { responseType: 'stream' });
			const chunks = res.data.pipe(new PassThrough({ encoding: 'base64' }));

			let content = '';
			for await (const chunk of chunks) content += chunk;
			result = await uploadContent(path, content);

			if (result.status === 201) {
				console.log(`🎞 thumbnail downloaded: ${path} 🎞`);
			} else {
				logError(result.message);
			}
		}
	}
}

async function request(url, options) {
	const res = await axios({
		url,
		method: (options && options.method) || 'get',
		headers: options && options.headers,
		data: (options && options.data) || null,
		responseType: (options && options.responseType) || 'json',
		validateStatus: false,
		maxContentLength: Infinity,
		maxBodyLength: Infinity
	});
	return res;
}

async function getContent(path) {
	const url = `https://api.github.com/repos/${REPO_NAME}/contents/${path}`;
	const options = {
		method: 'get',
		headers: {
			Accept: 'application/vnd.github.v3+json',
			Authorization: `token ${TOKEN}`
		}
	};
	const res = await request(url, options);
	return { status: res.status, message: `${url}: ${res.data.message}`, data: res.data };
}

async function uploadContent(path, content, sha) {
	const url = `https://api.github.com/repos/${REPO_NAME}/contents/${path}`;
	const data = {
		message: `upload ${path}`,
		content: content,
		sha: sha
	};
	const options = {
		method: 'put',
		headers: {
			Accept: 'application/vnd.github.v3+json',
			Authorization: `token ${TOKEN}`
		},
		data
	};
	const res = await request(url, options);
	res.data.message && logError(res.data.message, url);
	return { status: res.status, message: `${url}: ${res.data.message}`, data: res.data };
}

async function sendNotification(list) {
	console.log('💌 notification send 💌');
	if (!list || list.length == 0) return;

	if (!SERVER_J) return;

	const title = `Bing 每日壁纸收集完成 (${list.length})`;
	const content = list
		.map(
			(item, index) => `
# (${index + 1}) ${item.title}
## ${item.date}
[![${item.title}](https://www.bing.com/th?id=${item.fileName}&w=400&h=225)](https://www.bing.com/th?id=${item.fileName})
${item.desc}
`
		)
		.join('---');

	let url = `https://sctapi.ftqq.com/${SERVER_J}.send`;
	let body = new URLSearchParams();
	body.set('title', title);
	body.set('desp', content);
	await request(url, { method: 'POST', data: body });
	console.log('💌 ServerJ sent 💌');

	url = `https://api.day.app/${BARK}`;
	body = new URLSearchParams();
	body.set('title', title);
	body.set('body', content);
	await request(url, { method: 'POST', data: body });
	console.log('💌 Bark sent 💌');
}

getBingDailyList();
