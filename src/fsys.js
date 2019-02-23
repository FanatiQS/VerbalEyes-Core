'use strict';

const fs = require('fs');

const log = require('./log');



// Add file extension 'type' to 'path'
module.exports.addFileExt = function (path, type) {
	// Get file and index of extension separator
	const file = path.slice(path.lastIndexOf('/') + 1);
	const dot = file.lastIndexOf('.');

	// Add 'type' to end of 'path' if it has no file extension
	if (dot <= 0) return path + type;

	// Return 'path' if it has the correct file extension
	if (file.slice(dot) === type) return path;

	// Throw error if 'path' has the wrong file extension
	const err = Error("Wrong file extension for '" + path + "', it needs to be a " + type + " file");
	err.code = 'wrongtype';
	throw err;
};



// Create a file and its entire path containing 'content'
module.exports.createFile = function (path, content, callback) {
	prepLoop((callback) => {
		fs.writeFile(path, content, callback);
	}, callback);
};

// Create directory and its entire path
module.exports.createDir = function (path, callback) {
	prepLoop((callback) => {
		fs.mkdir(path, callback);
	}, callback);
};

// Create setup for 'loop' function
function prepLoop(action, callback) {
	loop([callback, action], 1);
}

// Create entire path for function in 'callbacks'
function loop(callbacks, i) {
	callbacks[i]((err) => {
		// If previous action was successfull
		if (!err) {
			// Decreace index
			i--;

			// Call last callback without error argument if end is reached
			if (i === 0) {
				callbacks[0](null);
				return;
			}
		}
		// Add callback that creates parent directory if path was not found
		else if (err.code === 'ENOENT') {
			callbacks.push((callback) => {
				fs.mkdir(err.path.slice(0, err.path.lastIndexOf('/')) || '/', callback);
			});
			i++;
		}
		// Run first callback with error object and stop for other errors
		else {
			callbacks[0](err);
			return;
		}

		// Run next callback from 'callbacks' array
		loop(callbacks, i);
	});
}



// Watch file for changes
const watchers = module.exports.watchers = {};
const watchFile = module.exports.watchFile = function (path, callback) {
	// Get name of file and path to parent directory of 'path'
	if (process.platform === 'win32') path = path.replace(/\\/g, '/');
	const split = path.lastIndexOf('/');
	const parent = (split === -1) ? '.' : path.slice(0, split) || '/';
	const target = path.slice(split + 1);

	// Create new watcher if one does not exist for the parent already
	if (!watchers[parent]) {
		// Create watcher
		watchers[parent] = fs.watch(parent, (type, name) => {
			console.log('im in fsys checking for watched files', name);//!!
			/*//!!## problems whith multiple calls on single change
			//!!
			if (!this.callbacks.hasOwnProperty(name) || this.callbacks[name].hold) return;

			//!!
			this.callbacks[name].hold = setTimeout(function () {
				//!!
				getFile(name, watchers[parent].callbacks[name]);

				//!!
				watchers[parent].callbacks[name].hold = null;
			}, 100);

			return;*/
			// If modified file has callback, get content and run callback
			/*if (this.callbacks.cooldown) return
			this.callbacks.cooldown = setTimeout(function () {
				watchers[parent].callbacks.cooldown = false;
			}, 4000);
			console.log(this.callbacks.cooldown);*/
			//!!## 'this' does not work anymore since I changed it to an arrow function

			// Run callback with file content if 'name' is watched
			if (callbacks[name]) fs.readFile(path, 'utf-8', (err, content) => {
				// Run callback unless 'target' was renamed FROM 'path'
				if (!err || err.code !== 'ENOENT') callbacks[name](err, content);
			});
		});

		// Create callbacks container
		watchers[parent].callbacks = {};
	}

	// Get callbacks folder
	const callbacks = watchers[parent].callbacks;

	// Add callback to watcher
	callbacks[target] = callback;

	// Return path and function to stop watching target
	return {
		path: path,
		close: () => {
			// Delete callback for target
			delete callbacks[target];

			// Close and remove watcher if no targets are being watched anymore
			if (!Object.keys(callbacks).length) {
				watchers[parent].close();
				delete watchers[parent];
			}

			// Log, stopped wathing file
			log(/@!/, "Stopped waching:", /@path/, path);
		}
	};
};

// Setup watcher for JSON file
module.exports.watchJSON = function (path, oldJSON) {
	// Setup watcher for JSON file
	return watchFile(path, (err, content) => {
		// Error handling for errors
		if (err) {
			log.err("Error reading contents of watched JSON file:", /@path/, path).ERROR(err);
			return;
		}

		// Parse content from file watching
		try {
			var newJSON = JSON.parse(content);
		}
		// Error handling for if parsing failed
		catch (err) {
			err.content = content;
			log.err("Unable to parse file:", /@path/, path).ERROR(err);
			return;
		}

		// Delete or update properties from 'newJSON' in 'oldJSON'
		Object.keys(oldJSON).forEach((key) => {
			// Ignore properties starting with underscore
			if (key[0] === '_') return;

			// Handle properties not matching
			if (oldJSON[key] !== newJSON[key]) {
				const pd = Object.getOwnPropertyDescriptor(oldJSON, key);
				const hasValue = newJSON.hasOwnProperty(key);

				// Get value of JSON before changing it
				const prev = oldJSON[key];

				// Handle updates if current property is configurable
				if (pd.configurable) {
					// Update property if 'newJSON' property exists
					if (hasValue) {
						try {
							oldJSON[key] = newJSON[key];
							log("Updated JSON property '" + key + "' from '" + prev + "' to '" + oldJSON[key] + "' in:", /@path/, path);
						}
						// Catch and log error if updating property fails
						catch (err) {
							log.err("Unable to update property '" + key + "' in:", /@path/, path).ERROR(err);
						}
					}
					// Delete or hide property if 'newJSON' does not contain that property
					else {
						// Delete property if it is a normal value
						if (pd.value) {
							delete oldJSON[key];
						}
						// Hide property if it is a getter/setter
						else {
							Object.defineProperty(oldJSON, key, {
								enumerable: false
							});
						}
						log("Removed JSON property '" + key + "' with value '" + prev + "' from:", /@path/, path);
					}
				}
				// Error message for locked property not being updated
				else if (hasValue) {
					log.err("Unable to update locked property '" + key + "' in:", /@path/, path);
				}
			}

			// Remove from list of properties to add
			delete newJSON[key];
		});

		// Add remaining properties to 'oldJSON'
		Object.keys(newJSON).forEach((key) => {
			// Ignore properties starting with underscore
			if (key[0] === '_') return;

			try {
				// Make property visible if it is hidden
				if (oldJSON.hasOwnProperty(key)) Object.defineProperty(oldJSON, key, {enumerable: true});

				// Add or update property
				oldJSON[key] = newJSON[key];

				// Log, added property
				log("Added JSON property '" + key + "' with value '" + oldJSON[key] + "' to:", /@path/, path);
			}
			// Catch and log error if updating property fails
			catch (err) {
				log.err("Unable to add property '" + key + "' to:", /@path/, path).ERROR(err);
			}
		});
	});
};
