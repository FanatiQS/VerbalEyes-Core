'use strict';

const path = require('path');

const log = require('./log');
const fsys = require('./fsys');
const syncOrAsync = require('./syncOrAsync');



// Create 'Loader' object to receive only valid functions from 'imported'
function Loader(imported, timerGetter, callback) {
	// Validate property of 'imported'
	const check = (prop, backup) => {
		// If property is a function, add it to this
		if (typeof imported[prop] === 'function') {
			this[prop] = syncOrAsync(imported[prop], prop, timerGetter);
		}
		// Error handling for if property is not a function
		else if (imported.hasOwnProperty(prop)) {
			throw "Property '" + prop + "' in custom script has to be a function: " + imported[prop];
		}
		// Error handling for missing property in 'imported' and using default error handling
		else if (backup === undefined) {
			throw "Missing property '" + prop + "' in custom script";
		}
		// If property is missing and a backup function exists, add 'backup' to this instead
		else {
			this[prop] = syncOrAsync(backup, prop, timerGetter);
		}
	};

	// Validate required functions
	check('getProj');

	// Validate non-required function, if they doesn't exist, return backup function
	check('getProjs', () => []);

	// Run 'callback' if successfully loaded 'imported' without errors
	callback('\n\t' + Object.keys(this).join('\n\t'));
}

// Get custom script functions
module.exports = function (input, timerGetter) {
	if (input) {
		try {
			// Load custom script from file at 'input'
			if (typeof input === 'string') {
				// Clarify path for console messages and for requireing the custom module
				input = path.resolve(input);

				// Log, started trying to get custom script file
				log("\nGetting custom script file:", input);

				// Check file extension on 'input' for error
				fsys.addFileExt(input, '.js');

				// Get and check custom script with absolute path
				return new Loader(require(input), timerGetter, (list) => {
					log("Successfully loaded custom script file:", input, list);
				});
			}
			// Get custom script from 'input'
			else if (input instanceof Object) {
				// Log, started trying to get custom object
				log("\nGetting custom script object");

				// Check custom script object
				return new Loader(input, timerGetter, (list) => {
					log("Successfully loaded custom script object:", list);
				});
			}
			// Error handling for if 'input' is of an unsupported type
			else {
				log.err("Invalid type, 'customScript' in config needs to be a string path or object:", input);
			}
		} catch (err) {
			// Error handling for if custom script file was not found
			if (err.code === 'MODULE_NOT_FOUND') {
				log.err("Unable to get module, file not found:", input);
			}
			// Error handling for if 'input' has the wrong file extension
			else if (err.code === 'wrongtype') {
				log.err("Unable to use 'customScript'. File extension needs to be blank or of javascript '.js' format:", input);
			}
			// Error handling for if any 'check' failes
			else if (typeof err === 'string') {
				log.err(err);
			}
			// Error handling for other errors
			else {
				throw err;
			}
		}

		// Log, failed loading custom script
		log("Failed to get custom script. Falling back to default systems");
	}
	// Log, no 'customScript' property in config
	else {
		log("\nSkipping custom script");
	}

	// Return built-in loader if custom script was not loaded
	return require('./default_loader');
};
