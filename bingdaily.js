const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');
const { URLSearchParams } = require('url');

const IMAGE_FOLDER = 'wallpapers';
const TMB_FOLDER = 'thumbnails';
const TMB_WIDTH = 400;
const INDEX_FILE = 'index.json';
const API_URL = 'https://www.bing.com/HPImageArchive.aspx?pid=hp&format=js&n=8&setmkt=en-us&setlang=en-us&ensearch=1';

const IMAGE_ON = process.env.IMAGE_ON || false;
const TMB_ON = process.env.TMB_ON || false;
const SERVER_J = process.env.SERVER_J;
console.warn('env', IMAGE_ON, TMB_ON, SERVER_J);

async function getBingDailyList() {
	let records = [];
	const newRecords = [];

	if (fs.existsSync(INDEX_FILE)) {
		records = JSON.parse(fs.readFileSync(INDEX_FILE));
	}

	const result = await request(API_URL);

	for (const image of result.data.images) {
		const info = {
			date: `${image.startdate.slice(0, 4)}-${image.startdate.slice(4, 6)}-${image.startdate.slice(6, 8)}`,
			fileName: `${image.urlbase.slice(7)}_UHD.jpg`,
			title: image.title,
			desc: image.desc,
			copyright: image.copyright
		};

		await downloadImage(info);

		if (!records.find((r) => r.fileName == info.fileName)) {
			records.push(info);
			newRecords.push(info);
			isDirty = true;
		}
	}

	if (newRecords.length > 0) {
		fs.writeFileSync(INDEX_FILE, JSON.stringify(records, null, '\t'));
		await sendNotification(newRecords);
	}
}

async function downloadImage(info) {
	if (IMAGE_ON) {
		const url = `https://www.bing.com/th?id=${info.fileName}`;
		const path = `${IMAGE_FOLDER}/${info.fileName}`;

		if (!fs.existsSync(IMAGE_FOLDER)) fs.mkdirSync(IMAGE_FOLDER);

		if (!fs.existsSync(path)) {
			const res = await request(url, { responseType: 'stream' });
			res.data.pipe(fs.createWriteStream(path));
			res.data.on('end', () => {
				console.log(`🖼 image downloaded: ${path} 🖼`);
			});
		}
	}

	if (TMB_ON) {
		const url = `https://www.bing.com/th?id=${info.fileName}&w=400&h=225`;
		const path = `${TMB_FOLDER}/${info.fileName}`;

		if (!fs.existsSync(TMB_FOLDER)) fs.mkdirSync(TMB_FOLDER);

		if (!fs.existsSync(path)) {
			const res = await request(url, { responseType: 'stream' });
			res.data.pipe(fs.createWriteStream(path));
			res.data.on('end', () => {
				console.log(`🎞 thumbnail downloaded: ${path} 🎞`);
			});
		}
	}
}

function createThumbnail(imagePath, thumbPath) {
	if (!fs.existsSync(TMB_FOLDER)) fs.mkdirSync(TMB_FOLDER);

	if (!fs.existsSync(thumbPath)) {
		exec(`convert -thumbnail ${TMB_WIDTH} ${imagePath} ${thumbPath}`);
		console.log(`thumbnail created: ${thumbPath}`);
	}
}

async function request(url, options) {
	const res = await axios({
		url,
		method: (options && options.method) || 'GET',
		data: (options && options.data) || null,
		responseType: (options && options.responseType) || 'JSON'
	});
	return res;
}

async function sendNotification(list) {
	console.log('💌 notification send 💌');
	if (!list || list.length == 0) return;

	if (!SERVER_J) return;

	const title = `Bing 每日壁纸收集完成 (${list.length})`;
	const content = list.map((item, index) => {
		return `
# (${index + 1}) ${item.title}

## ${item.date}

[![${item.title}](https://www.bing.com/th?id=${item.fileName}&w=400&h=225)](https://www.bing.com/th?id=${item.fileName})

${item.desc}

---
`;
	});

	const url = `https://sctapi.ftqq.com/${SERVER_J}.send`;
	const body = new URLSearchParams();
	body.set('title', title);
	body.set('desp', content);
	request(url, { method: 'POST', data: body })
		.then(() => console.log('💌 notification sent 💌'))
		.catch((err) => console.log(err));
	// console.log('💌 notification sent 💌');
}

getBingDailyList();
