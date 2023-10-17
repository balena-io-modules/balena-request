import { BalenaFile, getRequest } from './lib/request';


import * as fs from 'fs';
// import { Blob } from 'buffer';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MzU0MSwiYWN0b3IiOnsiX19pZCI6NTUxMTUyfSwidXNlcm5hbWUiOiJvdGF2aW9famFjb2JpIiwiZW1haWwiOiJvdGF2aW8uamFjb2JpQGJhbGVuYS5pbyIsImNyZWF0ZWRfYXQiOiIyMDIyLTAzLTI4VDE0OjMxOjE2LjM0NloiLCJqd3Rfc2VjcmV0IjoiUUZJSU5ZS0lDT0tRWElWNlhMSFFNQlFTSlU2NjZZVEsiLCJoYXNfZGlzYWJsZWRfbmV3c2xldHRlciI6dHJ1ZSwiZmlyc3RfbmFtZSI6Ik90YXZpbyIsImxhc3RfbmFtZSI6IkphY29iaSIsImFjY291bnRfdHlwZSI6InByb2Zlc3Npb25hbCIsInNvY2lhbF9zZXJ2aWNlX2FjY291bnQiOltdLCJjb21wYW55IjoiYmFsZW5hIiwiaGFzUGFzc3dvcmRTZXQiOnRydWUsInB1YmxpY19rZXkiOmZhbHNlLCJmZWF0dXJlcyI6W10sImludGVyY29tVXNlck5hbWUiOiJbU1RBR0lOR10gb3RhdmlvX2phY29iaSIsImludGVyY29tVXNlckhhc2giOiIyOGY3Njg3MjBmMjlhZjhkY2NkM2JmN2NlYTE2NGQ2ZTc5NDlhZmNkNjViODk0OGE2MjNiMWI2MjBkNmQ1NzI1IiwicGVybWlzc2lvbnMiOltdLCJhdXRoVGltZSI6MTY5NjM2MTU5NTcyMSwiaXNfdmVyaWZpZWQiOnRydWUsIm11c3RfYmVfdmVyaWZpZWQiOnRydWUsImlhdCI6MTY5NjM2MTU5NiwiZXhwIjoxNjk2OTY2Mzk2fQ.B7vOc6JpMWCZ1gcG5TLOHnydPNcQvn0CX3KrBJMvUQs';
const request = getRequest({auth: undefined, debug: true});
(async () => {

	const fileName = '/home/otavio/Pictures/logo-image-test/test-image.png';
	const buffer = [fs.readFileSync(fileName)];
	const body = {
		//logo_image: new BalenaFile(buffer, fileName),
		logo_image: new File(buffer, fileName, {type: 'img/png'}),
		name: 'hellohello'
	}

	const response = await request.send({
		method: 'POST',
		baseUrl: 'https://api.balena-staging.com',
		url: '/resin/organization',
		json: false,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		body
	});

	console.error(JSON.stringify(response.body, null, 2));
})();


// (async () => {

// 	// WORKS
// 	const form = new FormData();
// 	form.append('logo_image', fs.createReadStream('/home/otavio/Pictures/logo-image-test/ag.png'));
// 	form.append('name', 'testorg123');



// 	const response = await request.send({
// 		method: 'POST',
// 		baseUrl: 'https://api.c99231e352a06667560b3f82ec6fd813.bob.local',
// 		url: '/v6/organization',
// 		json: false,
// 		headers: {
// 			Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwiYWN0b3IiOnsiX19pZCI6Mn0sInVzZXJuYW1lIjoib3RhdmlvamFjb2JpIiwiZW1haWwiOiJvdGF2aW9qYWNvYmlAZ21haWwuY29tIiwiY3JlYXRlZF9hdCI6IjIwMjMtMDgtMDZUMjE6Mjk6MTAuODE3WiIsImp3dF9zZWNyZXQiOiJFM0JYSzJVSkhCNUVRSkVFVTJOMzJMNkJUNU9CVlNPRiIsImhhc19kaXNhYmxlZF9uZXdzbGV0dGVyIjp0cnVlLCJmaXJzdF9uYW1lIjoiIiwibGFzdF9uYW1lIjoiIiwiYWNjb3VudF90eXBlIjoiIiwic29jaWFsX3NlcnZpY2VfYWNjb3VudCI6W10sImNvbXBhbnkiOiIiLCJoYXNQYXNzd29yZFNldCI6dHJ1ZSwicHVibGljX2tleSI6ZmFsc2UsImZlYXR1cmVzIjpbXSwiaW50ZXJjb21Vc2VyTmFtZSI6IltDOTkyMzFFMzUyQTA2NjY3NTYwQjNGODJFQzZGRDgxM10gb3RhdmlvamFjb2JpIiwicGVybWlzc2lvbnMiOltdLCJhdXRoVGltZSI6MTY5MTM1NzM1MzA5NiwiaWF0IjoxNjkxMzU3MzUzLCJleHAiOjE2OTE5NjIxNTN9.j-vW6lSi4a4Sl-kQhyMCmkHVGPZL4LmCs-Duqah4aDE',
// 		},
// 		body: form
// 	});

// 	console.error(JSON.stringify(response.body, null, 2));
// })();

