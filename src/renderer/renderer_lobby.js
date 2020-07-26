'use strict';

const { ipcRenderer } = require('electron');

const btnConnectUber = document.getElementById('btn-connect-uber');
const txtUsername = document.getElementById('username');
const txtPassword = document.getElementById('password');
const txtLobbyStatus = document.getElementById('lobby-status');

btnConnectUber.addEventListener('click', () => {
	ipcRenderer.send('connect-uber', txtUsername.value, txtPassword.value);
});

ipcRenderer.on('login-success', () => {
	txtLobbyStatus.textContent = 'Login successful';
});

ipcRenderer.on('login-failed', (e, reason) => {
	txtLobbyStatus.textContent = `Login failed: ${reason}`;
});