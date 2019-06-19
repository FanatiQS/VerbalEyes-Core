'use strict';

// Add middleware to objects property to run callback when value is updated
module.exports = function observer(obj, key, callback) {
	// Get original/current properties
	const descriptor = Object.getOwnPropertyDescriptor(obj, key) || {};

	// Create getter and setter linked to value if no getter or setter already exist
	if (!(descriptor.get || descriptor.set)) {
		descriptor.get = function () {
			return descriptor.value;
		};
		descriptor.set = function (value) {
			descriptor.value = value;
		};
	}

	// Create setter function unless 'obj' is getter only
	if (descriptor.set) {
		var setter = function (value) {
			// Run middleware with new and old property value
			setter.mid(value, this[key]);

			// Run setter function
			descriptor.set(value);
		};

		// Create middleware function
		setter.mid = (value, current) => {
			// Make property visible if it is hidden
			if (!obj.propertyIsEnumerable()) {
				Object.defineProperty(obj, key, {
					enumerable: true
				});
			}

			// Run callback with new and old value as arguments
			callback(value, current);
		};
	}

	// Set property to use getter/setter
	Object.defineProperty(obj, key, {
		get: descriptor.get,
		set: setter,
		configurable: true
	});
};
