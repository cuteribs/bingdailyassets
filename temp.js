const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

const IMAGE_FOLDER = 'wallpapers';
const TMB_FOLDER = 'thumbnails';
const TMB_WIDTH = 400;
const INDEX_FILE = 'index.json';
const API_URL = 'https://r5ea.z7.web.core.windows.net/images.json';
let maxCommits = 100;

async function getBingDailyList() {
	let isDirty = false;
	let indexes = [];

	if (fs.existsSync(INDEX_FILE)) indexes = JSON.parse(fs.readFileSync(INDEX_FILE));

	const result = await request(API_URL);

	for (const image of result.data) {
		if(maxCommits <= 0) break;

		info = {
			date: image.date,
			fileName: `OHR.${image.fileName}_UHD.jpg`,
			title: image.title,
			desc: image.desc
		};

		if (!indexes.find((i) => i.fileName == info.fileName)) {
			indexes.push(info);
			isDirty = true;
		}

		await downloadImage(info);
	}

	if (isDirty) fs.writeFileSync(INDEX_FILE, JSON.stringify(records, null, '\t'));
}

async function downloadImage(info) {
	const url = `https://www.bing.com/th?id=${info.fileName}`;

	if (!fs.existsSync(IMAGE_FOLDER)) fs.mkdirSync(IMAGE_FOLDER);

	const imagePath = `${IMAGE_FOLDER}/${info.fileName}`;
	const thumbPath = `${TMB_FOLDER}/${info.fileName}`;

	if (fs.existsSync(imagePath)) {
		createThumbnail(imagePath, thumbPath);
	} else {
		const res = await request(url, { responseType: 'stream' });
		res.data.pipe(fs.createWriteStream(imagePath));
		res.data.on('end', () => {
			maxCommits -= 1;
			console.log(`image downloaded: ${imagePath}`);
			createThumbnail(imagePath, thumbPath);
		});
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

getBingDailyList();
