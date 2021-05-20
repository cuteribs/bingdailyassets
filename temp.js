const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

const IMAGE_FOLDER = 'wallpapers';
const TMB_FOLDER = 'thumbnails';
const TMB_WIDTH = 400;
const INDEX_FILE = 'index.json';
const API_URL = 'https://r5ea.z7.web.core.windows.net/images.json';
const MAX_COMMITS = process.env.MAX_COMMITS || 100;
const IMAGE_ON = process.env.IMAGE_ON || false;
const TMB_ON = process.env.TMB_ON || false;

async function getBingDailyList() {
	let commits = MAX_COMMITS;
	let isDirty = false;
	let records = [];

	if (fs.existsSync(INDEX_FILE)) {
		records = JSON.parse(fs.readFileSync(INDEX_FILE));
	}

	const result = await request(API_URL);

	for (const info of result.data) {
		if (commits <= 0) break;
		await downloadImage(info);

		if (!records.find((r) => r.fileName == info.fileName)) {
			records.push(info);
			isDirty = true;
			commits--;
		}
	}

	if (isDirty) fs.writeFileSync(INDEX_FILE, JSON.stringify(records, null, '\t'));
}

async function downloadImage(info) {
	if (IMAGE_ON) {
		const url = `https://www.bing.com/th?id=${info.fileName}`;
		const path = `${IMAGE_FOLDER}/${info.fileName}`;

		if (!fs.existsSync(IMAGE_FOLDER)) fs.mkdirSync(IMAGE_FOLDER);

		if (!fs.existsSync(path)) {
			const res = await request(url, { responseType: 'stream' });
			res.data.pipe(fs.createWriteStream(path));
			res.data.on('end', () => console.log(`🖼 image downloaded: ${path} 🖼`));
		}
	}

	if (TMB_ON) {
		const url = `https://www.bing.com/th?id=${info.fileName}&w=400&h=225`;
		const path = `${TMB_FOLDER}/${info.fileName}`;

		if (!fs.existsSync(TMB_FOLDER)) fs.mkdirSync(TMB_FOLDER);

		if (!fs.existsSync(path)) {
			const res = await request(url, { responseType: 'stream' });
			res.data.pipe(fs.createWriteStream(path));
			res.data.on('end', () => console.log(`🎞 thumbnail downloaded: ${path} 🎞`));
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
		responseType: (options && options.responseType) || 'JSON'
	});
	return res;
}

async function sendNotification(list) {
	if (!list || list.length == 0) return;

	if (!SERVER_J) return;

	const title = 'Bing 每日壁纸收集完成';
	const content = list.map((item) => {
		return `
# ${item.title}

## ${item.date}

[![${item.title}](https://www.bing.com/th?id=${item.fileName}&w=400&h=225)](https://www.bing.com/th?id=${infofileName})

${item.desc}
------
`;
	});

	const url = `https://sctapi.ftqq.com/${SERVER_J}.send`;
	const body = new URLSearchParams();
	body.set('title', title);
	body.set('desp', content);
	await request(url, { method: 'POST', body });
	console.log('💌 notification sent 💌');
}

getBingDailyList();
