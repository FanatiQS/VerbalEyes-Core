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
				const callback = arguments[arguments.length];

				// Create 'exit' function
				const exit = function () {
					// Fire 'callback' with an error if 'exit' has already been called
					if (err) {
						callback(err);
					}
					// Block any more calls of 'exit', clear timeout timer and fire 'callback' with all received arguments
					else {
						err = Error("This callback has already been called: " + prop);
						err.code = 'BLOCKED';
						clearTimeout(timeout);
						callback(...arguments);
					}
				};

				// Run 'func' with arguments and 'exit' callback for async
				try {
					var result = func(...arguments, exit);
				}
				// Exit with cought synchronous error
				catch (err) {
					exit(err);
					return;
				}

				// Exit with synchronous result
				if (result !== undefined) {
					exit(null, result);
				}
				// Create timeout for max wait on asynchronous return call
				else if (!err) {
					var timeout = setTimeout(() => {
						const error = Error("Timed out waiting for asynchronous callback on: " + prop);
						error.code = 'TIMEOUT';
						callback(error);
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

// Get custom loader functions
module.exports = function (input, timerGetter) {
	if (input) {
		try {
			// Get custom loader from file at 'input'
			if (typeof input === 'string') {
				// Clarify path for console messages and for requireing the module
				input = path.resolve(input);

				// Log, started trying to get module
				log("\nGetting custom loader file:", /@path/, input);

				// Check file extension on 'input' for error
				fsys.addFileExt(input, '.js');

				// Get and check module with absolute path
				return new CustomLoader(require(input), timerGetter, (list) => {
					log("Successfully added custom loader file:", /@path/, input, list);
				});
			}
			// Get custom loader from 'input' object
			else if (isObj(input)) {
				// Log, started trying to get object
				log("\nGetting custom loader object");

				// Check 'input' object
				return new CustomLoader(input, timerGetter, (list) => {
					log("Successfully added custom loader object:", list);
				});
			}
			// Error handling for if 'input' is of an unsupported type
			else {
				log.err("Invalid type, 'loader' in config needs to be a string path or object:", input);
			}
		} catch (err) {
			// Error handling for if custom loader file was not found
			if (err.code === 'MODULE_NOT_FOUND') {
				log.err("Unable to get custom loader module, file not found:", /@path/, input).ERROR(err);
			}
			// Error handling for if 'input' has the wrong file extension
			else if (err.code === 'wrongtype') {
				log.err("Unable to use 'loader'. File extension needs to be blank or of javascript '.js' format:", /@path/, input).ERROR(err);
			}
			// Error handling for if any 'checks' fail
			else if (typeof err === 'string') {
				log.err(err);
			}
			// Error handling for other errors
			else {
				throw err;
			}
		}

		// Log, failed adding custom loader
		log("Failed to add custom loader. Falling back to default systems");
	}
	// Log, no 'loader' property in config
	else {
		log("\nSkipping custom loader");
	}

	// Return built-in loader if custom loader was not added
	return require('./default_loader');
};
