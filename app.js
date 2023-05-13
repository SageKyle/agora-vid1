const APP_ID = '679d2104958b4bb2b95b6d369952771e';

let token = null;
let uid = String(Math.floor(Math.random() * 10000));
let client, channel;

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
	channel = client.createChannel('main');
	await channel.join();

	// trigger an event when a user joins
	channel.on('MemberJoined', handleUserJoined);

	channel.on('MemberLeft', handleUserLeft);

	// trigger an event when a peer sends message
	client.on('MessageFromPeer', handleMessageFromPeer);

	localStream = await navigator.mediaDevices.getUserMedia({
		video: true,
		audio: false,
	});
	document.querySelector('#user-1').srcObject = localStream;
}

async function createConnection(memberId) {
	peerConnection = new RTCPeerConnection(servers);

	remoteStream = new MediaStream();
	document.querySelector('#user-2').srcObject = remoteStream;

	if (!localStream) {
		localStream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: false,
		});
		document.querySelector('#user-1').srcObject = localStream;
	}

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
	document.querySelector('#user-2').srcObject = undefined;
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

init();
