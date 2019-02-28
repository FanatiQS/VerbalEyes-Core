'use strict';

const net = require('net');

const WS = require('ws');

const log = require('./log');
const isObj = require('./isObj');
const httpStatic = require('./httpStatic');



// On new client connection, create new 'Client' object and map to 'ws' events
function wsAdapter(wss, Client) {
	return wss.on('connection', (ws, req) => {
		// Get url query parameter 'name'
		const start = (req.url.indexOf('name=', req.url.indexOf('?') + 1 || req.url.length) + 1 || req.url.length) + 4;
		const name = req.url.slice(start, (req.url.indexOf('&', start) + 1 || req.url.length + 1) - 1) || null;

		// Create new client object
		const client = new Client(
			req.connection.remoteAddress,
			name,
			{
				/*!! replace this with just ws when done*/
				send: ws.send.bind(ws),
				close: ws.close.bind(ws)
			}
		);

		// Link 'ws' events to client functions
		ws.on('message', client.onmessage.bind(client));
		ws.on('error', client.onerror.bind(client));
		ws.on('close', client.onclose.bind(client));
	});
}

// Set up socket server
module.exports = function createSocketServer(server, port, Client) {
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
	// Return 'server' with new websocket connections adapted to 'Client' system
	else if (server.constructor.name === 'WebSocketServer') {
		log("Using supplied WebSocket server");
		return wsAdapter(server, Client);
	}
	// Return function for custom socket system
	else if (server === 'custom') {
		log("Using custom socket server");
		return Client;
	}
	// Error handling of unsupported 'server' types
	else if (!isObj(server)) {
		throw Error("Unable to create WebSocket server with: " + server);
	}

	// Log, crating new websocket
	log("Creating new WebSocket server on" + ((server.server) ? ': [Webserver]' : " port: " + server.port));

	// Setup WS server and apply adapter on new client for 'Client'
	const wss = wsAdapter(new WS.Server(server), Client);

	// Indicator for if websocket server was created internally or externally
	wss.internal = true;

	// Add system to add static files to http server
	if (wss.options.port) httpStatic.create(wss._server);

	// Log, successfully set up socket server
	wss.on('listening', () => log("Successfully created WebSocket server"));

	// Error handling for errors on 'wss'
	wss.on('error', (err) => {
		if (err.code === 'EADDRINUSE') log.err("This port is already in use:", err.port);
		throw err;
	});

	// Log, websocket server shutting down
	wss.on('close', () => log(/@!/,"Websocket server closed"));

	// Return 'wss'
	return wss;
};
