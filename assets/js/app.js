const APP_ID = '679d2104958b4bb2b95b6d369952771e';

let token = null;
let uid = String(Math.floor(Math.random() * 10000));
let client, channel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
const roomId = urlParams.get('room');

if (!roomId) {
	window.location = 'login.html';
}

let localStream, remoteStream;
let peerConnection;

const servers = {
	iceServers: [
		{
			urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
		},
	],
};

async function init() {
	client = AgoraRTM.createInstance(APP_ID);
	await client.login({ uid, token });

	// channel is going to be dynamic
	channel = client.createChannel(roomId);
	await channel.join();

	// trigger an event when a user joins
	channel.on('MemberJoined', handleUserJoined);

	channel.on('MemberLeft', handleUserLeft);

	// trigger an event when a peer sends message
	client.on('MessageFromPeer', handleMessageFromPeer);

	localStream = await navigator.mediaDevices.getUserMedia({
		video: true,
		audio: true,
	});
	// localStream.getAudioTracks().forEach((track) => (track.enabled = false));

	document.querySelector('#user-1').srcObject = localStream;
}

async function createConnection(memberId) {
	peerConnection = new RTCPeerConnection(servers);

	// initialize new video frame
	createNewVideoFrame(memberId);
	const newMmber = document.querySelector(`#user-${memberId}`);

	remoteStream = new MediaStream();
	newMmber.srcObject = remoteStream;
	newMmber.style.display = 'block';

	if (!localStream) {
		localStream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
		// localStream.getTracks().forEach((track) => (track.enabled = false));
		document.querySelector('#user-1').srcObject = localStream;
	}

	// const audioTrack = localStream
	// 	.getTracks()
	// 	.find((track) => track.kind == 'audio');
	// audioTrack.enabled = false;

	localStream.getTracks().forEach((track) => {
		peerConnection.addTrack(track, localStream);
	});

	peerConnection.ontrack = (event) => {
		event.streams[0].getTracks().forEach((track) => {
			remoteStream.addTrack(track);
		});
	};

	peerConnection.onicecandidate = async (event) => {
		if (event.candidate) {
			client.sendMessageToPeer(
				{
					text: JSON.stringify({
						type: 'candidate',
						candidate: event.candidate,
					}),
				},
				memberId
			);
		}
	};
}

async function createOffer(memberId) {
	await createConnection(memberId);

	let offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);

	// send an offer to peer
	// adding 'type' to identify the kind of message being sent/received
	client.sendMessageToPeer(
		{ text: JSON.stringify({ type: 'offer', offer }) },
		memberId
	);
}

async function handleUserJoined(memberId) {
	console.log('A new user has joined', memberId);
	// create and offer when a user joins
	createOffer(memberId);
}

async function handleUserLeft(memberId) {
	console.log('A user left: ', memberId);
	// hide video frame when user leaves
	document.querySelector(`#user-${memberId}`).style.display = 'none';
}

async function handleMessageFromPeer(message, memberId) {
	// parse the JSON (message)
	message = JSON.parse(message.text);

	switch (message.type) {
		// create an answer for the offer
		case 'offer':
			createAnswer(memberId, message.offer);
			break;

		// process an answer from peer
		case 'answer':
			AddAnswer(message.answer);
			break;

		// process add candidate
		case 'candidate':
			// add candidate if there is a good peer connection
			if (peerConnection) peerConnection.addIceCandidate(message.candidate);
			break;

		default:
			break;
	}
}

// create answer
async function createAnswer(memberId, offer) {
	await createConnection(memberId);

	await peerConnection.setRemoteDescription(offer);
	const answer = await peerConnection.createAnswer();

	await peerConnection.setLocalDescription(answer);

	client.sendMessageToPeer(
		{ text: JSON.stringify({ type: 'answer', answer }) },
		memberId
	);
}

async function AddAnswer(answer) {
	if (!peerConnection.currentRemoteDescription)
		peerConnection.setRemoteDescription(answer);
}

async function LeaveChannel() {
	await channel.leave();
	await client.logout();
}

// create a new video element for the new user
async function createNewVideoFrame(memberId) {
	const container = document.querySelector('.video__container');
	const newFrame = document.createElement('video');

	// set video element properties
	newFrame.id = `user-${memberId}`;
	newFrame.classList.add('video');
	newFrame.autoplay = true;
	newFrame.playsInline = true;

	// add element to parent wrapper element
	container.appendChild(newFrame);
}

// toggle video camera
async function toggleCamera() {
	const cameraBtn = document.querySelector('#camera-btn');
	const videoTrack = localStream
		.getTracks()
		.find((track) => track.kind === 'video');

	if (videoTrack.enabled) {
		videoTrack.enabled = false;
		cameraBtn.classList.add('danger-color');
	} else {
		videoTrack.enabled = true;
		cameraBtn.classList.remove('danger-color');
	}
}

document.querySelector('#camera-btn').addEventListener('click', toggleCamera);

// toggle mic
async function toggleMic() {
	const micBtn = document.querySelector('#mic-btn');
	const audioTrack = localStream
		.getTracks()
		.find((track) => track.kind === 'audio');

	if (audioTrack.enabled) {
		audioTrack.enabled = false;
		micBtn.classList.add('danger-color');
	} else {
		audioTrack.enabled = true;
		micBtn.classList.remove('danger-color');
	}
}

document.querySelector('#mic-btn').addEventListener('click', toggleMic);

// share chat
async function shareChat(url) {
	// TODO format chatData to be different if it's an ID
	const shareData = {
		title: "Let's Chat",
		text: "Join a live meeting on Let's Chat",
		url,
	};

	try {
		await navigator.share(shareData);
	} catch (err) {
		if (navigator.canShare == false) alert('not supported');
		console.log(err);
	}
}

document.querySelector('#share-btn').addEventListener('click', () => {
	document.querySelector('.share__group').classList.toggle('hidden');
});

document.querySelector('.share__group').addEventListener('click', async (e) => {
	const ChatURL = window.location.href;
	const queryId = window.location.search;
	const ChatId = queryId.slice(6);

	if (e.target.classList.contains('share-id')) {
		await shareChat(ChatId);
	}

	if (e.target.classList.contains('share-link')) {
		await shareChat(ChatURL);
	}
});

// trigger a channel leave when a user closes the tab/browser
window.addEventListener('beforeunload', LeaveChannel);

init();
