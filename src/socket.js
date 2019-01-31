'use strict';

const net = require('net');

const WS = require('ws');

const log = require('./log');



// On new client connect, create new client object for 'connections'
function wsAdapter(wss, Client) {
	return wss.on('connection', (ws, req) => {
		// Create new client object
		const client = new Client(req.connection.remoteAddress, {/*!! replace this with just ws when done*/
			send: function () {ws.send(...arguments);},
			close: function () {ws.close(...arguments);}
		});

		// Link ws events to client functions
		ws.on('message', client.onmessage.bind(client));
		ws.on('error', client.onerror.bind(client));
		ws.on('close', client.onclose.bind(client));
	});
}

// Set up socket server
module.exports = function createSocketServer(server, port, Client, callback) {
	// Log, setting up websocket server
	log("\nSetting up socket server");

	// Fix websocket input for undefined
	if (!server) {
		server = {port: port || 1994};
	}
	// Fix websocket input for TCP/IPC server object
	else if (server instanceof net.Server) {
		server = {server: server};
	}
	// Fix websocket input for port number
	else if (typeof server === 'number') {
		server = {port: server};
	}
	// Return 'server' with new websocket connections adapted to 'connections' system
	else if (server.constructor.name === 'WebSocketServer') {
		log("Using supplied WebSocket server");
		return wsAdapter(server, Client);
	}
	// Return function for custom socket system
	else if (server === 'custom') {
		log("Using custom socket server");
		return Client;
	}

	// Log, crating new websocket
	log("Creating new WebSocket server on" + ((server.server) ? ': [Webserver]' : " port: " + server.port));

	// Setup WS server and apply adapter on new client for 'Client'
	const wss = wsAdapter(new WS.Server(server, () => {
		// Run callback function
		callback();

		// Log, successfully set up socket server
		log("Successfully set up socket server");
	}), Client);

	// Error handling for errors on 'wss'
	wss.on('error', (err) => {
		if (err.code === 'EADDRINUSE') log.err("This address is already in use:", err.address + ':' + err.port);
		throw err;
	});

	// Return 'wss'
	return wss;
}
