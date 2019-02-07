'use strict';

// Check if argument is an object
module.exports = function (obj) {
	return (
		obj &&
		typeof obj === 'object' &&
		!Array.isArray(obj)
	) ? true : false;
};
