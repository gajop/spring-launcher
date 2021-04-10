'use strict';

const got = require('got');
const isDev = false;
const api_backend = isDev ? 'http://localhost:3000/api' : 'http://backend.spring-launcher.com/api';

async function springToNextgen(springName) {
	try {
		const response = await got.post(`${api_backend}/versions/from-springname/`, {
			json: {
				springName: springName
			},
			responseType: 'json'
		});

		return response.body.nextgenName;
	} catch (error) {
		console.warn(error);
		return null;
	}
}

module.exports = {
	springToNextgen: springToNextgen
};
