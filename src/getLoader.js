'use strict';

const path = require('path');

const log = require('./log');
const fsys = require('./fsys');
const isObj = require('./isObj');



// Create 'Loader' object to receive only valid functions from 'imported'
function CustomLoader(imported, timerGetter, callback) {
	// Validate property of 'imported'
	const check = (prop, backup) => {
		const func = imported[prop] || backup;

		// If 'func' is a function, add it to 'this'
		if (typeof func === 'function') {
			this[prop] = function () {
				let err;

				// Disable callback argument
				arguments.length --;

				// Link to callback argument
				const exit = arguments[arguments.length];

				// Create callback function and add timeout clear to callback argument
				const callback = function () {
					// Exit with an error if callback has already been called
					if (err) {
						exit(err);
					}
					// Block any more calls of 'callback', clear timeout timer and exit with all arguments
					else {
						err = Error("This callback has already been called: " + prop);
						err.code = 'BLOCKED';
						clearTimeout(timeout);
						exit(...arguments);
					}
				};

				// Run 'func' with arguments and callback for async
				try {
					var result = func(...arguments, callback);
				}
				// Run 'callback' with cought synchronous error
				catch (err) {
					callback(err);
					return;
				}

				// Run 'callback' with synchronous result
				if (result !== undefined) {
					callback(null, result);
				}
				// Create timeout for max wait on asynchronous return call
				else if (!err) {
					var timeout = setTimeout(() => {
						const error = Error("Timed out waiting for asynchronous callback on: " + prop);
						error.code = 'TIMEOUT';
						exit(error);
					}, timerGetter() || 1000);
				}
			};
		}
		// Error handling for if 'func' is not a function
		else if (func) {
			throw "Property '" + prop + "' in custom script has to be a function: " + func;
		}
		// Error handling for missing property in 'imported' and there is no 'backup'
		else {
			throw "Missing property '" + prop + "' in custom script";
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
					log("Successfully loaded custom script file:", input, list);
				});
			}
			// Get custom script from 'input'
				// Log, started trying to get custom object
				log("\nGetting custom script object");

				// Check custom script object
				return new Loader(input, timerGetter, (list) => {
					log("Successfully loaded custom script object:", list);
			else if (isObj(input)) {
				return new CustomLoader(input, timerGetter, (list) => {
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
