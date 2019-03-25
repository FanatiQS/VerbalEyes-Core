'use strict';

const dns = require('dns');

const bcrypt = require('bcrypt');

const log = require('./log');
const isObj = require('./isObj');



// Get name of ip-address
function getNameFromIP(ip, name, callback) {
	// Use name if defined
	if (name) {
		callback(name);
	}
	// Abort if 'ip' is undefined
	else if (!ip) {
		callback(null);
	}
	// Return 'localhost' for localhost address
	else if (ip === '::1' || ip.slice(0, 4) === '127.') {
		callback('localhost');
	}
	// Return hostname of reverse DNS lookup if any
	else {
		try {
			dns.reverse(ip, (err, host) => {
				// Abort if unable to find hostname of 'ip'
				if (!Array.isArray(host)) {
					callback(ip);
					return;
				}

				// Return hostname of 'ip' without extension
				const name = host[0];
				callback(name.slice(0, name.lastIndexOf('.')));
			});
		}
		// Error handling for malformed 'ip' or other dns lookup error
		catch(err) {
			log.err("Error looking up client name").ERROR(err);
			callback(ip);
		}
	}
}



// Create a 'client' instance
const Client = module.exports = function Client(server, addr, name, socket) {
	// Make work with or without 'new' operator
	if (!(this instanceof Client)) return new Client(...arguments);

	// Make arguments reachable from prototype
	this.server = server;
	this.socket = socket;



	// Create buffer for log messages
	this.log = log.buffer();
	this.err = this.log.err;

	// Get ID for client
	server.clients ++;
	this.id = server.clients;

	// Get ip of client and convert ipv4 mapped in ipv6 back to ipv4
	this.ip = ((addr || '').match(/\d+\.\d+(\.\d+)*/) || [addr])[0];

	// Get name or hostname of ip
	getNameFromIP(this.ip, name, (hostname) => {
		// Prefix used for log messages is 'id' and 'hostname'
		this.prefix = '[#' + this.id + ' - ' + hostname + ']:';

		// Restore normal log functions and log buffered messages
		this.log.flush(this);
		delete this.log;
		delete this.err;
	});

	// Log error message and terminate client if 'send' is missing
	if (!socket || !socket.send) {
		this.err("Unable to create new client. Missing 'send' function");
		this.close();
		return {};
	}



	// Will be populated when authenticated
	this.proj = null;

	// List of all documents this client is connected to
	this.docs = [];

	// Start receiver with authentication function
	this.rx = auth;

	// Log, new client connected
	this.log("A new client connected to the server from:", /@ip/, this.ip);
};

// Receiver function for incoming messages
Client.prototype.onmessage = function (data) {
	try {
		// Get property 'Zayght' of parsed 'data' or used as is
		var obj = ((typeof data === 'string') ? JSON.parse(data) : data).Zayght;

		// Abort if property 'Zayght' is undefined/false
		if (!obj) return;

		// Throw error if 'obj' is not an object
		if (!isObj(obj)) throw TypeError("Property 'Zayght' needs to be an object: " + obj);
	}
	// Log and send error to client if unable to get 'Zayght' object
	catch (err) {
		const msg = "Error handling incoming data object: " + data;
		this.err(msg).ERROR(err);
		this.tx({
			err: {
				code: 1000,
				message: msg,
				error: err.stack
			}
		});
		return;
	}

	// Run 'rx' with 'obj'
	this.rx.call(this, obj);
};

// Transmitt data to client
Client.prototype.tx = function (obj) {
	// Send object stringified to client
	try {
		this.socket.send(JSON.stringify({Zayght: obj}));
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
		const autoLogin = this.server.conf.autoLogin;

		// Error handling for if 'autologin' is disabled
		if (!autoLogin) {
			authFail.call(
				this,
				2000,
				"Unable to authenticate, autologin is disabled"
			);
			return;
		}
		else {
			// Get project 'autologin'
			this.server.getProj(autoLogin, null, (proj) => {
				this.log("Using automatic login to project:", autoLogin);

				// Error handling for if loading project 'autologin' failed
				if (!proj) {
					authFail.call(
						this,
						2001,
						"Unalbe to load project: " + autoLogin
					);
				}
				// Authenticate client to 'autologin'
				else {
					authSuccess.call(this, proj);
				}
			});

			// Add client to 'librarySlaves' list
			this.server.librarySlaves.push(this);
		}
	}
	// Error handling for if 'id' is not a string
	else if (typeof obj.id !== 'string') {
		authFail.call(
			this,
			3000,
			"Project ID needs to be a string: " + obj.id
		);
	}
	// Error handling for if 'id' is longer than 128 characters
	else if (obj.id.length > 128) {
		authFail.call(
			this,
			3001,
			"Unable to connect to project with ID longer than 128 characters"
		);
	}
	// Get project and authenticate
	else {
		// Log, client tries to connect to 'id'
		this.log('Trying to connect to:', obj.id);//!!

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
				bcrypt.hash(obj.pwd, 10, (err, hash) => {
					// Update to new hash and authenticate client
					if (!hash) {
						this.err("Error hashing pwd").ERROR(err);
						authFail.call(this, 3002, "Unable to hash password");
					}
					// Error handling if hashing 'pwd' failed
					else {
						proj.settings.hash = hash;
						authSuccess.call(this, proj, buffer);
					}
				});
			}
			// Compare 'pwd' and 'hash'
			else if (proj.settings.hash) {
				// Error handling for if 'pwd' is not specified
				if (!obj.pwd) {
					authFail.call(this, 2002, "A password is required");
					return;
				}

				// Compare 'pwd' with stored 'hash'
				bcrypt.compare(obj.pwd, proj.settings.hash, (err, res) => {
					// Error handling for if 'pwd' does not match 'hash'
					if (!res) {
						if (err) this.err("Error comparing pwd with hash").ERROR(err);
						authFail.call(this, 2003, "Password was incorrect");
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
}

// Authentication failed
function authFail(code, message) {
	// Log and send error to client
	this.err(message);
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
	this.log("Authenticated to:", proj.id);

	// Call for all buffered messages
	buffer.forEach((value) => {
		this.rx.call(this, value);
	});
}

}
