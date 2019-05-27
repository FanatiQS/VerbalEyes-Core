'use strict';

const fs = require('fs');
const util = require('util');

/*
 * POSSIBLE STYLES

 * text color			black, red, green, yellow,
						blue, magenta, cyan, white, gray

 * background colors	_black, _red...

 * styles				b=bold, i=italic, u=underline

 * @ is for presets, what is immidiately after @ is the name of the preset

 * log 					logs message to console, logfile and html db

 * err 					logs red "ERROR:" + message to same as 'log' + errfile

 * ERROR 				property in err return logs arguments to console + errfile

 * dbMax				is the max number of lines to be stored in the html db. Default is 1000.

 * if log or err is placed as a property on an object with a 'prefix' property, that will be put in front of the message

 */



// Write 'msg' to 'tty', 'basic' and push html update
function display(args, error) {
	// Sort out messages and styles from 'args'
	const msg = getMsg(...args);

	// Get prefix
	const prefix = this && this.prefix;

	// Write 'msg' stylized for terminal if function is defined
	if (write.tty) {
		write.tty(
			((prefix) ? '\x1b[32;1;4m' + '[#' + prefix + ']:' + '\x1b[0m ' : '')
			+ ((error) ? '\x1b[31;1;4m' + error + '\x1b[0m ' : '')
			+ msg.map(ttyMapper).join('')
		);
	}

	// Write 'msg' without styling to 'basic' outputs
	if (write.basic.log || (error && write.basic.error)) {
		const clean = ((prefix) ? '[#' + prefix + ']: ' : '')
		+ ((error) ? error + ' ' : '')
		+ msg.join('');

		if (write.basic.log) write.basic.log(clean);
		if (error && write.basic.error) write.basic.error(clean);
	}
	// Send update for html if any listeners exist
	if (listeners.length) {
		// Create attributes and spans for 'prefix' and 'error'
		let attr = '';
		let span = '';
		if (prefix) {
			attr += ' data-prefix="' + prefix + '"';
			span += '<span class="prefix">[#' + prefix + ']:</span> ';
		}
		if (error) {
			attr += ' class="Error"';
			span += '<span class="error-prefix">' + error + '</span> ';
		}

		// Supply all listeners with 'msg' stylized for html
		listeners.forEach((callback) => callback('<div' + attr + '>'
		+ span + msg.map(htmlMapper).join('') + '</div>'));
	}
}



// Sort out expression styles in message arguments
function getMsg() {
	const output = [];
	output.styles = [];
	output.type = [];

	// Loop over all arguments sorting out expressions
	[...arguments].forEach((value) => {
		// Add expressions as strings in array to 'styles'
		if (value instanceof RegExp) {
			output.styles[output.length] = [].concat(...value
				.toString()
				.slice(1,-1)
				.split(' ')
				.map((val) => {
					// Use preset value of 'value' as style
					if (val[0] === '@') {
						return (exports.presets[val] || '').split(' ');
					}

					// Use 'value' as style
					return val;
				})
			);

			// Filter out expression
			return;
		}

		// Use 'value' unformated
		if (typeof value === 'string') {
			output.type[output.length] = 'string';
			output[output.length] = value;
		}
		// Format 'value'
		else {
			const inspected = util.inspect(value, {colors: true});
			const i = inspected.indexOf('\u001b');
			if (i === -1) {
				output[output.length] = inspected;
			}
			else {
				if (i > 0) output[output.length] = inspected.slice(0, i);
				stringToArray.call(output, inspected, i);
			}
		}

		// Separator between arguments
		output[output.length] = ' ';
	});

	// Export 'output' with properties
	return output;
}

// Split string up and add to array for styling
function stringToArray(str, start) {
	// End index for styling
	const i = str.indexOf('m', start);

	// Abort if end is reached
	if (i === str.length - 1) return;

	// Get type ansi code
	const type = str.slice(start + 2, i);
	if (type !== '39' && type !== '22') this.type[this.length] = type;

	// Get stylized content
	const i2 = str.indexOf('\u001b', i);
	this[this.length] = str.slice(i + 1, (i2 !== -1) ? i2 : str.length);

	// Go to next style
	if (i2 !== -1) stringToArray.call(this, str, i2);
}



// Style codes for terminal
const ttyMap = {
	black: 30,
	red: 31,
	green: 32,
	yellow: 33,
	blue: 34,
	magenta: 35,
	cyan: 36,
	white: 37,
	gray: 90,

	_black: 40,
	_red: 41,
	_green: 42,
	_yellow: 43,
	_blue: 44,
	_magenta: 45,
	_cyan: 46,
	_white: 47,
	_gray: 100,

	b: 1,
	i: 3,
	u: 4
};

// Type styles for terminal
const ttyTypes = {
	number: [33],
	boolean: [33],
	null: [1],
	undefined: [90],
	function: [36],
	string: [35],

	//!!## this is just a temporary workaround
	'33': [33],
	'1': [1],
	'90': [90],
	'36': [36],
	'32': [32],
	'35': [35]
};

// Add terminal styles to values
function ttyMapper(value, i, arr) {
	const ansi = [];

	// Add type styles and custom styles
	if (arr.type[i]) ansi.push(ttyTypes[arr.type[i]]);
	if (arr.styles[i]) ansi.push(...arr.styles[i].map((style) => ttyMap[style]));

	// Add terminal styling to 'value'
	if (ansi.length) return '\x1b[' + ansi.join(';') + 'm' + value + '\x1b[0m';

	// Return only 'value' if it has no styling
	return value;
}



// Style attributes for html
const htmlMap = {
	black: 'color: black',
	red: 'color: red',
	green: 'color: green',
	yellow: 'color: yellow',
	blue: 'color: blue',
	magenta: 'color: magenta',
	cyan: 'color: cyan',
	white: 'color: white',
	gray: 'color: gray',

	_black: 'background: black',
	_red: 'background: red',
	_green: 'background: green',
	_yellow: 'background: yellow',
	_blue: 'background: blue',
	_magenta: 'background: magenta',
	_cyan: 'background: cyan',
	_white: 'background: white',
	_gray: 'background: gray',

	b: 'font-weight: bold',
	i: 'font-style: italic',
	u: 'text-decoration: underline'
};

// Add HTML styles to values
function htmlMapper(value, i, arr) {
	let attr = '';

	// Add 'class' attribute for 'type'
	if (arr.type[i]) attr += ' class="type-' + arr.type[i] + '"';

	// Add 'style' attribute for 'styles'
	if (arr.styles[i]) {
		attr += ' style="' + arr.styles[i].map((style) => {
			return htmlMap[style];
		}).join(';') + '"';
	}

	// Return attributes and value in a span
	if (attr) return '<span' + attr + '>' + value + '</span>';

	// Return only 'value' if it has no attributes
	return value;
}



// Log arguments and include prefix if 'this' has a 'prefix' property
exports = function log() {
	display.call(this, arguments);
};

// Log arguments as error message to normal places and 'basic' error
exports.err = function err() {
	// Display message
	display.call(this, arguments, 'ERROR:');

	// Return function to handle error objects
	return errOutput;
};

// Send error objects to 'basic' error and 'tty'
const errOutput = {
	ERROR: function () {
		const msg = getMsg(...arguments);
		if (write.tty) write.tty(msg.map(ttyMapper).join(''));
		if (write.basic.error) write.basic.error(msg.join(''));
	}
};



// Get log functions adding their messages to a buffer
exports.buffer = function buffer() {
	const buffer = [];

	// Create 'log' and 'err' functions bound to 'buffer'
	const output = addToBuffer.bind([buffer, exports]);
	output.err = function () {
		addToBuffer.call([buffer, exports.err], ...arguments);
		return {ERROR: addToBuffer.bind([buffer, errOutput.ERROR])};
	};

	// Create 'flush' function bound to 'buffer'
	output.flush = bufferFlush.bind(buffer);

	// Return buffering 'log' function
	return output;
};

// Push arguments with callback to 'buffer'
function addToBuffer() {
	arguments.callback = this[1];
	this[0].push(arguments);
}

// Call every buffered message with its callback, setting 'this' to 'self'
function bufferFlush(self) {
	this.forEach((value) => value.callback.call(self, ...value));
}



// Subscribe to new html messages
const listeners = [];
exports.subscribe = function (callback) {
	listeners.push(callback);
};



// Preset styles
exports.presets = {
	'@path': 'u cyan',
	'@!': 'b u red',
	'@ip': 'i, yellow'
};



// Export log function containing other functions
module.exports = exports;



// Create HTML db and getter with max HTML messages
exports.createHtmlDB = function (dbMax) {
	// Database for html messages and listen for new messages to add
	const db = [];
	exports.subscribe((msg) => {
		// Push 'html' to database
		db.push(msg);

		// Limit size of database
		if (db.length > (dbMax)) db.shift();
	});

	// Return getter function for DB
	return function getDB() {
		return db.join('');
	}
}



// Write functions
const write = exports.writers = {
	tty: (process.stdout.isTTY) ? function (msg) {
		process.stdout.write(msg + '\n');
	} : null,
	basic: {
		log: null,
		error: null
	}
};



// Make 'logs' directory if it does not exist
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// Create writestream
function filestream(name) {
 	const stream = fs.createWriteStream('logs/' + name + '.txt', {flags: 'a'});
	return (msg) => stream.write(msg + '\n');
}

// Create log file streams
write.basic = {
	log: filestream('log'),
	error: filestream('error')
};


