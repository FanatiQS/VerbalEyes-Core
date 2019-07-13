'use strict';

// Run callback on update to objects property
exports.observe = function observe(obj, key, callback) {
	// Get original/current properties
	const descriptor = Object.getOwnPropertyDescriptor(obj, key) || {};

	// Create getter and setter linked to value if getter and setter doesn't exist
	if (!(descriptor.get || descriptor.set)) {
		descriptor.get = function () {
			return descriptor.value;
		};
		descriptor.set = function (value) {
			descriptor.value = value;
		};
	}

	// Abort if property is getter only
	if (!descriptor.set) return;

	// Redefine setter function to run middleware
	const setter = function (value) {
		// Run middleware with new property value
		setter.mid(value);

		// Run setter function
		descriptor.set(value);
	};

	// Create middleware function
	setter.mid = (value) => {
		// Make property visible if it is hidden
		if (!obj.propertyIsEnumerable()) {
			Object.defineProperty(obj, key, {
				enumerable: true
			});
		}

		// Run callback with new value as arguments
		callback(value);
	};
	// Set property to use getter/setter
	Object.defineProperty(obj, key, {
		get: descriptor.get,
		set: setter,
		configurable: true
	});
};

// Run callback on update to objects property and child properties
exports.observeAll = function (obj, key, callback) {
	let wait = false;
	let cleanup = deepObserve(obj, key, (value) => {
		// Only run callback once
		if (wait) return;
		wait = true;

		// Run callback when all changes to 'obj' has been made
		process.nextTick(() => {
			cleanup();
			callback(value);
			wait = false;
		});
	})
}

// Observe all child properties of property 'key' in 'obj'
function deepObserve(obj, key, callback) {
	let stored;

	// Observe 'key' property on 'obj' for changes
	exports.observe(obj, key, callback);

	// Observe all immediate child properties
	if (typeof obj[key] === 'object') {
		var cleanupers = Object.keys(obj[key]).map((key2) => {
			return deepObserve(obj[key], key2, (value) => {
				// Add 'value' to 'key2' property in predefined object
				if (stored) {
					stored[key2] = value;
					return;
				}

				// Create new object for 'value' at 'key2' and return parent
				stored = {[key2]: value};
				callback(stored);
			})
		})
	}

	// Return function to empty all child 'stored' variables
	return () => {
		stored = null;
		if (cleanupers) cleanupers.forEach((empty) => empty());
	};
}
