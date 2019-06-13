'use strict';

const dns = require('dns');

const log = require('./log');
const kdf = require('./kdf');
const isObj = require('./isObj');



// Get name of ip-address
function getNameFromIP(addr, callback) {
	// Get ip of client and convert ipv4 mapped in ipv6 back to ipv4
	const ip = (addr.match(/\d+\.\d+\.\d+\.\d+/) || [addr])[0];

	// Return 'localhost' for localhost address
	if (ip === '::1' || ip.slice(0, 4) === '127.') {
		callback('localhost');
		return;
	}

	// Return hostname of reverse DNS lookup if any
	try {
		dns.reverse(ip, (err, host) => {
			// Abort if unable to find hostname of 'ip'
			if (!Array.isArray(host)) {
				callback(ip);
				return;
			}

			// Return hostname of 'ip' without extension
			callback(host[0].slice(0, host[0].lastIndexOf('.')));
		});
	}
	// Error handling for malformed 'ip' or other dns lookup error
	catch (err) {
		log.err("Error looking up client name").ERROR(err);
		callback(ip);
	}
}



// Create a 'client' instance
const Client = module.exports = function Client(server, socket, name, addr) {
	// Make work with or without 'new' operator
	if (!(this instanceof Client)) return new Client(...arguments);

	// Make arguments reachable from prototype
	this.server = server;
	this.socket = socket;



	// Get ID for client
	server.clients ++;
	this.id = server.clients;

	// Set 'prefix' to 'id' and 'name'
	if (name || !addr) {
		this.prefix = this.id + ' - ' + name;
	}
	// Set 'prefix' to hostname or IP of 'addr'
	else {
		// Create buffer for log messages
		this.log = log.buffer();
		this.err = this.log.err;

		// Get hostname or IP of 'addr'
		getNameFromIP(addr, (hostname) => {
			// Set 'prefix' to 'id' and 'hostname'
			this.prefix = this.id + ' - ' + hostname;

			// Restore normal log functions and log buffered messages
			this.log.flush(this);
			delete this.log;
			delete this.err;
		});
	}

	// Log error message and terminate client if 'send' is missing
	if (!socket || !socket.send) {
		this.err("Unable to create new client. Missing 'send' function");
		if (socket.close) socket.close();
		return {};
	}



	// The project this client is connected to, will be set when authenticated
	this.proj = null;

	// List of all documents this client is connected to
	this.docs = [];

	// Start receiver with authentication function
	this.rx = auth;

	// Log, new client connected
	this.log("A new client connected to the server");
};

// Receiver function for incoming messages
Client.prototype.message = function (data) {
	// Get object by parsing incoming 'data' if it is a string
	try {
		var obj = (typeof data === 'string') ? JSON.parse(data) : data;
	}
	// Log and send error to client if parsing failed
	catch (err) {
		this.err("Error parsing incoming data").ERROR(err);
		this.tx({
			err: {
				code: 1000,
				message: "Error parsing incoming data",
				data: data,
				error: err.message
			}
		});
		return;
	}

	// Handle 'core'
	if (obj._core) {
		// Log and send error to client if '_core' is not an object
		if (!isObj(obj._core)) {
			const msg = "Property '_core' needs to be an object: " + typeof obj._core;
			this.err(msg);
			this.tx({
				err: {
					code: 1001,
					message: msg,
					data: obj._core
				}
			});
			return;
		}

		// Run 'rx' with 'obj._core'
		this.rx.call(this, obj._core);
	}
	// Relay received data to all clients connected to the same project
	else if (obj.relay) {
		// Error handling for if this client is not authenticated to a project
		if (!this.proj) {
			this.err("Unable to relay data before being authenticated");
			return;
		}

		// Broadcast data to all clients connected to the same project
		this.proj.clients.forEach((client) => {
			if (this !== client) client.tx(obj);
		});
	}
};

// Transmitt data to client
Client.prototype.tx = function (obj) {
	// Send object stringified to client
	try {
		this.socket.send(JSON.stringify({_core: obj}));
	}
	// Error handling for if sending data or stringifying failed
	catch (err) {
		this.err("Unable to send data to client:", obj).ERROR(err);
	}
};

// Cleanup and log message when socket closes
Client.prototype.close = function () {
	// Remove from 'librarySlaves'
	this.server.librarySlaves.splice(this.server.librarySlaves.indexOf(this), 1);

	// Disconnect from all documents
	this.docs.forEach((doc) => {
		doc.clients.splice(doc.clients.indexOf(this));
	});

	// Log, client disconnected
	this.log("Disconnected from the server");
};

// Add client specific 'log' and 'err' functions for 'prefix'
Client.prototype.log = log;
Client.prototype.err = log.err;



// Authenticate client
function auth(obj) {
	// Buffer for messages before authentication is complete
	const buffer = [];
	this.rx = (obj) => buffer.push(obj);

	// Use 'autologin' if property 'id' is false
	if (!obj.id) {
		// Error handling for if 'autologin' is disabled
		if (!this.server.conf.autoLogin) {
			authFail.call(
				this,
				2000,
				"Unable to authenticate, autologin is disabled"
			);
			return;
		}

		// Get project 'autologin'
		this.server.getProj(this.server.conf.autoLogin, null, (proj) => {
			this.log("Using automatic login to project:", this.server.conf.autoLogin);

			// Error handling for if loading project 'autologin' failed
			if (!proj) {
				authFail.call(
					this,
					2001,
					"Unalbe to load project: " + this.server.conf.autoLogin
				);
				return;
			}

			// Authenticate client to 'autologin'
			authSuccess.call(this, proj, buffer);
		});

		// Add client to 'autoLogins' list
		this.server.autoLogins.push(this);
		return;
	}
	// Error handling for if 'id' is not a string
	else if (typeof obj.id !== 'string') {
		authFail.call(
			this,
			3000,
			"Project ID needs to be a string: " + obj.id
		);
		return;
	}
	// Error handling for if 'id' is longer than 128 characters
	else if (obj.id.length > 128) {
		authFail.call(
			this,
			3001,
			"Unable to connect to project with ID longer than 128 characters"
		);
	}

	// Log, client tries to connect to 'id'
	this.log('Trying to connect to project:', obj.id);

	// Get project 'id'
	this.server.getProj(obj.id, obj.init, (proj) => {
		// Error handling for if loading project 'id' failed
		if (!proj) {
			authFail.call(
				this,
				2001,
				"Unable to load project: " + obj.id
			);
		}
		// Generate hash if 'hash' property in 'settings' is 'true'
		else if (proj.settings.hash === true) {
			kdf.hash(obj.pwd, 10, (err, hash) => {
				// Error handling if hashing 'pwd' failed
				if (!hash) {
					this.err("Error hashing pwd").ERROR(err);
					authFail.call(
						this,
						3001,
						"Internal error"
					);
					return;
				}

				// Update to new hash and authenticate client
				proj.settings.hash = hash;
				authSuccess.call(this, proj, buffer);
			});
		}
		// Compare 'pwd' and 'hash'
		else if (proj.settings.hash) {
			// Error handling for if 'pwd' is not specified
			if (!obj.pwd) {
				authFail.call(
					this,
					2002,
					"A password is required"
				);
				return;
			}

			// Compare 'pwd' with stored 'hash'
			kdf.verify(obj.pwd, proj.settings.hash, (err, res) => {
				// Error handling for if 'pwd' does not match 'hash'
				if (!res) {
					// Error handling for if 'compare' got an error
					if (err) {
						this.err("Error comparing pwd with hash").ERROR(err);
						authFail.call(
							this,
							3001,
							"Internal error"
						);
						return;
					}

					// Error handling for if 'pwd' did not match
					authFail.call(
						this,
						2003,
						"Password was incorrect"
					);
					return;
				}

				// Authenticate client if 'pwd' maches 'hash'
				authSuccess.call(this, proj, buffer);
			});
		}
		// Authenticate client if project has no 'hash'
		else {
			authSuccess.call(this, proj, buffer);
		}
	});
}

// Authentication failed
function authFail(code, message) {
	// Log and send error to client
	this.err("Authentication failed:", message);
	this.tx({
		authErr: {
			code,
			message
		}
	});

	// Terminate client connection
	this.close();
}

// Authenticate client
function authSuccess(proj, buffer) {
	// Add 'proj' to client
	this.proj = proj;

	// Add client to list of clients in 'proj'
	this.proj.clients.push(this);

	// Send authentication confirmation to client
	this.tx({
		authed: {
			id: proj.id,
			serverID: this.id
		}
	});

	// Update receiver function
	this.rx = datareceiver;

	// Log, client was authenticated
	this.log("Authenticated to project:", proj.id);

	// Handle all buffered messages
	buffer.forEach((value) => {
		this.rx.call(this, value);
	});
}

}
