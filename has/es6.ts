import has = require('../has');

has.add('es6-getpropertydescriptor', () => {
	return typeof (<any>Object).getPropertyDescriptor === 'function';
});

export = has;
