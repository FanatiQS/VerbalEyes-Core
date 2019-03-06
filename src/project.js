'use strict';

const ShareDB = require('sharedb');
const richtext = require('rich-text');

// Register richtext format in ShareDB
ShareDB.types.register(richtext.type);



// Create project instance
const Project = module.exports = function (projID, settings) {
	this.id = projID;
	this.clients = [];
	this.settings = settings;
	this.sharedb = new ShareDB({
		disableDocAction: true,
		disableSpaceDelimitedActions: true
	})
}
