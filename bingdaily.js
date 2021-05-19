const MESSAGE = `
# A path lain with petals

## 2021-05-19

![Test](https://cuteribs.ga/bingdaily/thumbnails/OHR.RoanRhododendron_EN-US8777664012_UHD.jpg)

Pisgah National Forest, in western North Carolina, is primarily a hardwood forest boasting 500,000 acres of mountainous peaks and cascading waterfalls that attract hikers, anglers, mountain bikers, and more. But from mid-May to mid-June, the crowds flock here to hike trails that lead to incredible views: acres of native Catawba rhododendrons in full blossom.
`;

const fs = require('fs');
const axios = require('axios');
const { exec } = require('child_process');

const IMAGE_FOLDER = 'wallpapers';
const TMB_FOLDER = 'thumbnails';
const TMB_WIDTH = 400;
const INDEX_FILE = 'index.json';
const API_URL = 'https://www.bing.com/HPImageArchive.aspx?pid=hp&format=js&n=8&setmkt=en-us&setlang=en-us&ensearch=1';

async function getBingDailyList() {
	let isDirty = false;
	let records = [];

	if (fs.existsSync(INDEX_FILE)) {
		records = JSON.parse(fs.readFileSync(INDEX_FILE));
	}

	const result = await request(API_URL);

	for (const image of result.data.images) {
		info = {
			date: `${image.startdate.slice(0, 4)}-${image.startdate.slice(4, 6)}-${image.startdate.slice(6, 8)}`,
			fileName: `${image.urlbase.slice(7)}_UHD.jpg`,
			title: image.title,
			desc: image.desc,
			copyright: image.copyright
		};

		await downloadImage(info);

		if (!records.find((r) => r.fileName == info.fileName)) {
			records.push(info);
			isDirty = true;
		}
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
