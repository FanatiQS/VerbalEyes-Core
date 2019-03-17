'use strict';

const fs = require('fs');
const path = require('path');

const log = require('./log');
const fsys = require('./fsys');



// Get an array of all existing projects
exports.getProjs = function test(conf, callback) {
	// Get path for projects directory
	try {
		var dir = path.resolve(conf.projsDir || 'projects');
	}
	// Error handling for if resolving path fails
	catch (err) {
		log.err("Unable to use projects directory:", conf.projsDir);
		callback(null, null);
		return;
	}

	// Get all directories in 'dir' directory
	fs.readdir(dir, {withFileTypes: true}, (err, files) => {
		// Error handling
		if (err) {
			// Error handling for if projsDir does not exist
			if (err.code === 'ENOENT') {
				fsys.createDir(dir, () => {});
				log.err("Unable to find projects directory, creating new one:", dir);
				callback(null, null);
				return;
			// Error handling for other errors
			} else {
				callback(err);
				return;
			}
		}

		// Run callback with sorted out directories from 'dir'
		callback(null, files.filter((file) => file.isDirectory()).map((file) => file.name));
	});
};

// Load project settings from json file
exports.getProj  = function (projID, init, conf, callback) {
	let settings;
	let dir;

	// Get path to projects directory
	const projsDir = path.resolve(conf.projsDir || 'projects', projID);

	// Check if directory exists
	fs.readdir(projsDir, (err) => {
		// Abort if 'readFile' already returned an error
		if (dir === null) return;

		// Return error if reading directory failed
		if (err) {
			callback((err.code !== 'ENOENT') ? err : null, null);
			settings = null;
			return;
		}

		// Return 'settings' if it has already been set by 'readFile'
		if (settings) {
			callback(null, settings);
			return;
		}

		// Indicator that directory exists for 'readFile'
		dir = true;
	});

	// Get content of settings file
	fs.readFile(projsDir + '.json', (err, content) => {
		// Abort if 'readdir' already returned an error
		if (settings === null) return;

		// Return error if getting 'content' of file failed and it was not 'ENOENT'
		if (err && err.code !== 'ENOENT') {
			callback(err);
			dir = null;
			return;
		}

		// Parse 'content' if any
		if (content) {
			try {
				settings = JSON.parse(content);
			}
			// Return error if parsing failed
			catch (err) {
				callback(err);
				dir = null;
				return;
			}
		}
		// Set 'settings' to empty object if file does not exist or is empty
		else {
			settings = {};
		}

		// Return 'settings' if 'readdir' has been read successfully
		if (dir) {
			callback(null, settings);
		}
	});
};
