const form = document.querySelector('#join-form');

form.addEventListener('submit', (e) => {
	e.preventDefault();
	const description = document.querySelector('.desc');

	let inviteCode = e.target.invite__link.value;
	// remove whitespace and convert to lowercase
	inviteCode = inviteCode.replace(/\s/g, '').toLocaleLowerCase();

	// chat ID should be at least six characters
	if (inviteCode.length < 6) {
		description.style.color = 'red';
	} else {
		window.location = `index.html?room=${inviteCode}`;
	}
});

const startChatBtn = document.querySelector('.btn-secondary');

startChatBtn.addEventListener('click', () => {
	const chatId = generateId(6);
	window.location = `index.html?room=${chatId}`;
});

function generateId(length) {
	let result = '';
	const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	let counter = 0;
	while (counter < length) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
		counter += 1;
	}
	return result;
}
