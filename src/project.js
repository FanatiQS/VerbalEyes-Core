'use strict';

const Delta = require('quill-delta');

const log = require('./log');



// Create project instance
const Project = module.exports = function (projID, settings) {
	this.id = projID;
	this.settings = settings;
	this.docs = {};
}
