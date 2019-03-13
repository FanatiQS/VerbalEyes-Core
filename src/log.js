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



// Preset styles
const presets = {
	'@path': 'u cyan',
	'@!': 'b u red',
	'@ip': 'i, yellow'
};



// Boolean for if console leads to a terminal or not
const tty = process.stdout._type === 'tty';

// Display 'msg' in console, in file and add to database
function display(args) {
	// Sort out messages and styles from 'args'
	const msg = getMsg(...args);

	// Create prefix array
	const prefix = (this && this.prefix) ? [this.prefix] : [];

	// Log 'msg' stylized to terminal or unstlylized to file
	console.log(
		...prefix.map((value) => termMapper(value, 0, getMsg(/green b u/, value))),
		...(tty) ? msg.map(termMapper) : msg
	);

	// Log 'msg' undstylized to file
	file.log(util.format('%s',...prefix, ...msg));



	// Get 'msg' stylized for html
	const html = '<div' + (
		(prefix[0]) ? ' data-prefix="' + prefix[0] + '" </div><span class="prefix">' + prefix[0] + '</span' : ''
	) + '>' + msg.map(htmlMapper).join(' ') + '</div>';

	// Push 'html' to the database
	db.push(html);

	// Limit size of database
	if (db.length > (exports.dbMax)) db.shift();

	// Supply all listeners with 'html'
	listeners.forEach((callback) => callback(html));

	// Return sorted 'msg'
	return msg;
}



// Sort out expression styles in message arguments
function getMsg() {
	let index = 0;
	const styles = [];
	const type = [];

	// Loop over all arguments sorting out expressions
	const output = [...arguments].filter((value) => {
		// Add expressions as strings in array to 'styles'
		if (value instanceof RegExp) {
			styles[index] = [].concat(...value.toString()
				.slice(1,-1)
				.split(' ')
				.map((elm) => {
					// Use preset value of 'value' as style
					if (elm[0] === '@') {
						return (presets[elm] || '').split(' ');
					}

					// Use 'value' as style
					return elm;
				}
				));

			// Filter out expression
			return;
		}

		// Store type of 'value'
		type[index] = (value === null) ? 'null' : typeof value;

		// Pass 'value' to 'output' and increment 'index'
		index ++;
		return true;
	});

	// Export 'output' with properties
	output.styles = styles;
	output.type = type;
	return output;
}



// Style codes for terminal
const termMap = {
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

// Default styles per type
const termDefaults = {
	number: [33],
	boolean: [33],
	null: [1],
	undefined: [90],
	function: [36],
	string: [35]
};

// Add terminal styles to values
function termMapper(value, i, arr) {
	const styles = arr.styles[i];
	const type = arr.type[i];

	// Do not add styles to objects
	if (type === 'object') return value;

	// Add default and custom styles to 'value' if it has custom styles
	if (styles) {
		return addTermStyles(
			termDefaults[type].concat(styles.map((style) => termMap[style])), value
		);
	}

	// Add default styles to 'value'
	return addTermStyles(termDefaults[type], value);
}

// Add terminal styling to 'value'
function addTermStyles(styles, value) {
	return '\x1b[' + styles.join(';') + 'm' + value + '\x1b[0m';
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
	const styles = arr.styles[i];
	const type = arr.type[i];
	const attr = [];

	// Add 'class' attribute
	attr.push('class="' + type + '"');

	// Format 'value' of object type
	if (type === 'object') {
		value = util.format(value);
	}
	// Add 'style' attribute if not an object type
	else if (styles) {
		attr.push('style="' + styles.map((style) => htmlMap[style]).join(';') + '"');
	}

	// Return attributes and value in a span
	if (attr.length) return '<span ' + attr.join(' ') + '>' + value + '</span>';

	// Return only value if it has no attributes
	return value;
}



// Database for html messages and listeners listening for new html messages
const db = [];
const listeners = [];



// Make 'logs' directory if it does not exist
if (!fs.existsSync('logs')) fs.mkdirSync('logs');

// Create log file streams
const options = {flags: 'a'};
const file = new console.Console(
	fs.createWriteStream('logs/log.txt', options),
	fs.createWriteStream('logs/error.txt', options)
);



// Log arguments and include prefix if 'this' has a 'prefix' property
exports = function log() {
	display.call(this, arguments);
};

// Log arguments as error message to normal places and error file
exports.err = function err() {
	// Display 'msg' on normal places
	const msg = display.call(this, [/red b u/, 'ERROR:', ...arguments]);

	// Send 'msg' to error write stream file
	file.error(util.format('%s', ...msg));

	// Return function to handle error objects
	return errOutput;
};

// Send error objects to error write stream and console
const errOutput = {
	ERROR: function () {
		file.error(...arguments);
		console.error(...arguments);
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



// Export log function containing other functions
module.exports = exports;

// Add HTML getter, listener creator and max HTML messages number
exports.get = () => db.join(' ');
exports.subscribe = (callback) => listeners.push(callback);
exports.dbMax = 1000;
