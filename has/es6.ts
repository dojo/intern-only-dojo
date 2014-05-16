import has = require('../has');

has.add('es6-getpropertydescriptor', typeof (<any> Object).getPropertyDescriptor === 'function');

export = has;
