'use strict';

const path = require('path');

const log = require('./log');
const fsys = require('./fsys');
const isObj = require('./isObj');



// Create 'Loader' object to receive only valid functions from 'imported'
function CustomLoader(imported, timerGetter, callback) {
	// Validate property of 'imported'
	const check = (prop, optional) => {
		// If linked function is a function, add it to 'this'
		if (typeof imported[prop] === 'function') {
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
						callback(arguments[0] || err);
					}
					// Block any more calls of 'exit', clear timeout timer and fire 'callback' with all received arguments
					else {
						err = Error("This callback has already been called: " + prop);
						err.code = 'BLOCKED';
						clearTimeout(timeout);
						callback(...arguments);
					}
				};

				// Run linked function with arguments and 'exit' callback for async
				try {
					var result = imported[prop].call(this, ...arguments, exit);
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
		// Error handling for if linked property is not a function
		else if (imported[prop]) {
			throw "Property '" + prop + "' in custom script has to be a function: " + imported[prop];
		}
		// Error handling for missing property in 'imported' unless it is optional
		else if (!optional) {
			throw "Missing property '" + prop + "' in custom script";
		}
	};

	// Validate required functions
	check('loadProj');
	check('loadDoc');
	check('saveDoc');

	// Validate optional functions
	check('getProjs', true);

	// Run 'callback' if successfully loaded 'imported' without errors
	callback();
}

// Get custom loader functions
module.exports = function (input, timerGetter) {
	if (input) {
		try {
			// Get custom loader from file at 'input'
			if (typeof input === 'string') {
				// Clarify path for requireing the module and console messages
				input = path.resolve(input);

				// Log, started trying to get module
				log("Getting custom loader file:", /@path/, input);

				// Check file extension on 'input' for error
				fsys.addFileExt(input, '.js');

				// Get and check module with absolute path
				return new CustomLoader(require(input), timerGetter, () => {
					log("Successfully added custom loader file:", /@path/, input);
				});
			}
			// Get custom loader from 'input' object
			else if (isObj(input)) {
				// Log, started trying to get object
				log("Getting custom loader object");

				// Check 'input' object
				return new CustomLoader(input, timerGetter, () => {
					log("Successfully added custom loader object");
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
		log("Skipping custom loader");
	}

	// Return built-in loader if custom loader was not added
	return require('./default_loader');
};
