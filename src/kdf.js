'use strict';

const bcrypt = require('bcrypt');

exports.hash = bcrypt.hash;
exports.verify = bcrypt.compare;
