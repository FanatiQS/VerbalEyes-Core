'use strict';

const fs = require('fs');
const path = require('path');

const log = require('./log');
const fsys = require('./fsys');
const isObj = require('./isObj');
const observer = require('./observer');



// Watch config file
function watchConf(confInput, config) {
	// Watch file at path 'confInput'
	config._watcher = fsys.watchJSON(confInput, config);

	// Log, set up config watcher
	log("Watching config file:", /@path/, confInput);
}

// Get config data
function getObj(confInput) {
	// Get config settings and get 'watcher' for 'config' file
	if (typeof confInput === 'string') {
		try {
			// Add file extension if nonexistent
			confInput = fsys.addFileExt(path.resolve(confInput), '.json');

			// Get parsed JSON content of config file at path 'confInput'
			const config = JSON.parse(fs.readFileSync(confInput));

			// Log, completed config setup
			log("Successfully read config file:", /@path/, confInput);

			// Watch 'config'
			watchConf(confInput, config);

			// Return config object
			return config;
		}
		catch (err) {
			// Create new config file if it was not found
			if (err.code === 'ENOENT') {
				// Log, creating new file, it does not exist
				log.err("Unable to locate config file. Creating a new one:", /@path/, confInput);

				// Create new config object
				const config = {_createFileCallback: null};

				// Create a new file and entire path asynchronously
				fsys.createFile(confInput, '{\n\t\n}', (err) => {
					// Get '_createFileCallback' callback function
					const callback = config._createFileCallback;

					// Delete '_createFileCallback' for cleaner look in callback response
					delete config._createFileCallback;

					// Fire 'callback' if it exists and return
					if (callback) {
						callback(err, config, confInput);
						if (err) return;
					}

					// Log and throw error if no error catcher function exists
					if (err) {
						log.err("Failed to create config file at:", /@path/, confInput);
						throw err;
					}

					// Log, created new file
					log("Created new config file at:", /@path/, confInput);

					// Watch 'config'
					watchConf(confInput, config);
				});

				// Return config object
				return config;
			}
			// Log, error message if 'confInput' has the wrong file extension
			else if (err.code = 'wrongtype') {
				log.err(err.message);
				throw err;
			}
			// Error handling for errors other than if file is not found
			else {
				log.err((err.message.match(/JSON/)) ? "Error parsing config file:" : "Error getting config file:", confInput);
				throw err;
			}
		}
	}
	// Return input object
	else if (isObj(confInput)) {
		log("Using config object");
		return confInput;
	}
	// Error handling for unsupported argument types
	else {
		const err = TypeError("Unable to setup config, 'confInput1' needs to be an object or a path to a JSON file");
		log.err(err.message);
		throw err;
	}
}

// Get config object, create middlewares and links
module.exports = function (confInput1, confInput2, observers) {
	// Log, getting config settings
	log("Setting up config settings...");

	// Set 'confInput1' to './config.json' if it is left undefined
	if (!confInput1) confInput1 = './config.json';

	// Get conf data
	const conf = getObj(confInput1);

	// Set up observer for every property in 'observers' on 'conf' and fire observers callback on change
	Object.keys(observers).forEach((key) => {
		// Error handling for if property is not a function
		if (typeof observers[key] !== 'function') throw Error("Observer callback for '" + key + "' has to be a function: " + observers[key]);

		// Add observer to 'conf' property 'key'
		observer(conf, key, observers[key]);
	});

	// Handle locked properties from 'confInput2'
	if (confInput2) {
		// Add links to all 'confInput2' properties in 'conf'
		if (isObj(confInput2)) {
			// Add locked properties
			const locked = Object.keys(confInput2);
			locked.forEach((key) => {
				// Log, error message for if 'conf' already has the property
				if (conf.propertyIsEnumerable(key)) log.err("Unable to use '" + key + "' from config, property is locked");

				// Update 'confInput2' property if 'conf' has setter middleware
				const pd = Object.getOwnPropertyDescriptor(conf, key);
				const mid = pd && pd.set && pd.set.mid;
				if (mid) {
					// Get property descriptor of 'confInput2'
					const conf2Prop = Object.getOwnPropertyDescriptor(confInput2, key);

					// Create getter/setter if value is used
					if (conf2Prop.value) {
						conf2Prop.get = function () {
							return conf2Prop.value;
						};
						conf2Prop.set = function (value) {
							conf2Prop.value = value;
						};
					}

					// Set up getter/setter on 'confInput2'
					Object.defineProperty(confInput2, key, {
						get: conf2Prop.get,
						set: (!conf2Prop.set) ? undefined : function (value) {
							mid(value, this[key]);
							conf2Prop.set(value);
						}
					});
				}

				// Create link to 'confInput2' property in 'conf'
				Object.defineProperty(conf, key, {
					get: function () {
						return confInput2[key];
					},
					set: undefined,
					enumerable: true,
					configurable: false
				});
			});

			// Log, locked properties list
			log((locked.length) ? "Locked properties in config:\n\t" + locked.join('\n\t') : "No locked properties in config");
		}
		// Error handling for if 'confInput2' is not an object
		else {
			log.err("Unable to add locked properties from:", confInput2);
		}
	}

	// Log, finnished setting up config with content of 'conf' unless it is empty
	const confKeys = Object.keys(conf).filter((key) => key[0] !== '_');
	log("Completed config setup", ...(!confKeys.length) ? [] : ["with settings:"]
		.concat(...confKeys.map((key) => ['\n\t' + key + ':', conf[key]])));

	// Return 'conf' object
	return conf;
};
