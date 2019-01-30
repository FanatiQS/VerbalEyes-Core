'use strict';

// Call a function so it accepts both synchronous and asynchronous calls
module.exports = function syncOrAsync(func, name, timerGetter) {
	return function () {
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
				return;
			}
			// Block any more calls of 'callback', clear timeout timer and exit with all arguments
			else {
				err = Error("This callback has already been called: " + name);
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
				const error = Error("Timed out waiting for asynchronous callback on: " + name);
				error.code = 'TIMEOUT';
				exit(error);
			}, timerGetter() || 1000);
		}
	};
};
