'use strict';

const net = require('net');

const WS = require('ws');

const log = require('./log');
const isObj = require('./isObj');
const httpStatic = require('./httpStatic');



// Get value from URL query parameter 'param'
function getQueryProperty(url, param) {
	// Get index of question mark and return undefined if not found
	const qm = url.indexOf('?') + 1;
	if (!qm) return;

	// Get index of query parameter and return undefined if not found
	const paramIndex = url.indexOf(param + '=', qm) + 1;
	if (!paramIndex) return;

	// Set start and end positions for query parameter value
	const start = paramIndex + param.length;
	const end = Math.max(0, url.indexOf('&', start)) || undefined;

	// Get parameter value and decode URI endocded characters
	return decodeURIComponent(url.slice(start, end).replace(/\+/g, ' '));
}

// On new client connection, create new 'Client' object and map to 'ws' events
function wsAdapter(wss, Client) {
	return wss.on('connection', (ws, req) => {
		// Create new client object
		const client = new Client(
			req.connection.remoteAddress,
			getQueryProperty(req.url, 'prefix'),
			{
				/*!! replace this with just ws when done*/
				send: ws.send.bind(ws),
				close: ws.close.bind(ws)
			}
		);

		// Link 'ws' events to client functions
		ws.on('message', client.onmessage.bind(client));
		ws.on('close', client.onclose.bind(client));

		// Terminate websocket and log message on error
		ws.on('error', (err) => {
			// Terminate websocket
			ws.close();

			// Log, error message
			client.err(/red/, "Error in socket connection").ERROR(err);
		});
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
		Client.getQueryProperty = getQueryProperty;
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

	// Return 'wss'
	return wss;
};
