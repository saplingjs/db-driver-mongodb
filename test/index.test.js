const test = require('ava');

const { MongoClient } = require('mongodb');

const MongoDB = require('../index');


test.before(async t => {
	t.context.mongodb = new MongoDB();

	t.context.client = new MongoClient(`mongodb://localhost:27017`, {
		useNewUrlParser: true,
		useUnifiedTopology: true
	});
	t.context.connection = await t.context.client.connect();
	t.context.db = await t.context.client.db('test');
});


test.serial('connects to database', async t => {
	await t.notThrowsAsync(async () => {
		return await t.context.mongodb.connect({
			name: 'test',
			host: 'localhost',
			port: 27017
		});
	});
});

test.serial('creates a collection', async t => {
	await t.context.mongodb.createCollection('first');

	const collections = await t.context.db.listCollections().toArray();

	t.is(collections.length, 1);
	t.is(collections[0].name, 'first');
});

test.serial('creates a second collection', async t => {
	await t.context.mongodb.createCollection('second');

	const collections = await t.context.db.listCollections().toArray();

	t.is(collections.length, 2);
	t.true(collections.some(coll => coll.name === 'first'));
	t.true(collections.some(coll => coll.name === 'second'));
});

test.serial('creates an index', async t => {
	await t.context.mongodb.createCollection('uniques');
	await t.context.mongodb.createIndex('uniques', { email: 'unique' });

	const indices = await t.context.db.collection('uniques').indexes();

	t.is(indices.length, 2);
	t.true(indices.some(index => index.key._id === 1));
	t.true(indices.some(index => index.key.email === 1));
});

test.serial('creates a new record in an existent collection', async t => {
	const results = await t.context.mongodb.write('first', { foo: 'bar', baz: 1 });

	t.is(results.result.ok, 1);

	const records = await t.context.db.collection('first').find({}).toArray();

	t.is(records.length, 1);
	t.is(records[0].foo, 'bar');
	t.is(records[0].baz, 1);
});

test.serial('creates a second new record in an existent collection', async t => {
	const results = await t.context.mongodb.write('first', { foo: 'qux', baz: 2 });

	t.is(results.result.ok, 1);

	const records = await t.context.db.collection('first').find({}).toArray();

	t.is(records.length, 2);
	t.true(records.some(record => record.foo === 'qux'));
	t.true(records.some(record => record.baz === 2));
});

test.serial('creates a new record in a non-existent collection', async t => {
	const results = await t.context.mongodb.write('third', { foo: 'bar', baz: 1 });

	t.is(results.result.ok, 1);

	const records = await t.context.db.collection('third').find({}).toArray();

	t.is(records.length, 1);
	t.is(records[0].foo, 'bar');
	t.is(records[0].baz, 1);
});

test.serial('throws an error attempting to create record with non-unique value for a unique field', async t => {
	await t.context.mongodb.write('uniques', { email: 'john@example.com' });

	await t.throwsAsync(async () => {
		return await t.context.mongodb.write('uniques', { email: 'john@example.com' });
	}, {
		code: 11000
	});
});

test.serial('reads all records in a collection', async t => {
	const results = await t.context.mongodb.read('first', {});

	t.true(Array.isArray(results));
	t.is(results.length, 2);
});

test.serial('reads a record by ID', async t => {
	const existingRecords = await t.context.db.collection('first').find({}).toArray();

	const results = await t.context.mongodb.read('first', { _id: existingRecords[0]._id });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
});

test.serial('reads a record by string value', async t => {
	const results = await t.context.mongodb.read('first', { foo: 'bar' });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'bar');
	t.is(results[0].baz, 1);
});

test.serial('reads a record by numerical value', async t => {
	const results = await t.context.mongodb.read('first', { baz: 2 });

	t.true(Array.isArray(results));
	t.is(results.length, 1);
	t.is(results[0].foo, 'qux');
	t.is(results[0].baz, 2);
});

test.serial('reads records by array value', async t => {
	await t.context.mongodb.write('first', { foo: 'wax', baz: 10 });

	const results = await t.context.mongodb.read('first', { foo: ['bar', 'qux'] });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].foo, 'bar');
	t.is(results[1].foo, 'qux');
});

test.serial('reads a record by a preceding wildcard', async t => {
	await t.context.mongodb.write('fifth', { name: 'New Hampshire' });
	await t.context.mongodb.write('fifth', { name: 'New York' });
	await t.context.mongodb.write('fifth', { name: 'North Yorkshire' });
	await t.context.mongodb.write('fifth', { name: 'Hamptons' });
	await t.context.mongodb.write('fifth', { name: 'Mumbai' });

	const results = await t.context.mongodb.read('fifth', { name: '*shire' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'North Yorkshire');
});

test.serial('reads a record by a middle wildcard', async t => {
	const results = await t.context.mongodb.read('fifth', { name: 'n*shire' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'North Yorkshire');
});

test.serial('reads a record by a tailing wildcard', async t => {
	const results = await t.context.mongodb.read('fifth', { name: 'new*' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'New York');
});

test.serial('reads a record by multiple wildcards', async t => {
	const results = await t.context.mongodb.read('fifth', { name: '*amp*' });

	t.true(Array.isArray(results));
	t.is(results.length, 2);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'Hamptons');
});

test.serial('reads records by array of wildcards', async t => {
	const results = await t.context.mongodb.read('fifth', { name: ['new*', '*york*'] });

	t.true(Array.isArray(results));
	t.is(results.length, 3);
	t.is(results[0].name, 'New Hampshire');
	t.is(results[1].name, 'New York');
	t.is(results[2].name, 'North Yorkshire');
});

test.serial('reads nothing in a non-existent collection', async t => {
	const results = await t.context.mongodb.read('fourth', {});

	t.true(Array.isArray(results));
	t.is(results.length, 0);
});

test.serial('modifies one record by ID', async t => {
	const existingRecords = await t.context.db.collection('first').find({}).toArray();

	await t.context.mongodb.modify('first', { _id: existingRecords[0]._id }, { new: 'hello' });

	const records = await t.context.db.collection('first').find({ _id: existingRecords[0]._id }).toArray();

	t.is(records.length, 1);
	t.is(records[0].new, 'hello');
});

test.serial('modifies records by string value', async t => {
	await t.context.mongodb.modify('first', { foo: 'bar' }, { foo: 'quux' });

	const records = await t.context.db.collection('first').find({ foo: 'quux' }).toArray();

	t.is(records.length, 1);
	t.is(records[0].foo, 'quux');
	t.is(records[0].baz, 1);
	t.is(records[0].new, 'hello');
});

test.serial('modifies records by numerical value', async t => {
	await t.context.mongodb.modify('first', { baz: 2 }, { foo: 'qax' });

	const records = await t.context.db.collection('first').find({ baz: 2 }).toArray();

	t.is(records.length, 1);
	t.is(records[0].foo, 'qax');
	t.is(records[0].baz, 2);
});

test.serial('modifies nothing in a non-existent collection', async t => {
	await t.context.mongodb.modify('fourth', { baz: 2 }, { foo: 'qax' });

	const records = await t.context.db.collection('fourth').find({ baz: 2 }).toArray();

	t.true(Array.isArray(records));
	t.is(records.length, 0);
});

test.serial('throws an error attempting to modify record with non-unique value for a unique field', async t => {
	await t.context.mongodb.write('uniques', { email: 'sally@example.com' });

	await t.throwsAsync(async () => {
		return await t.context.mongodb.modify('uniques', { email: 'john@example.com' }, { email: 'sally@example.com' });
	}, {
		code: 11000
	});
});

test.serial('deletes one record by ID', async t => {
	await t.context.mongodb.write('first', { foo: 'baz', baz: 4 });
	await t.context.mongodb.write('first', { foo: 'boz', baz: 0 });
	await t.context.mongodb.write('first', { foo: 'bez', baz: 3 });

	const existingRecords = await t.context.db.collection('first').find({}).toArray();

	t.is(existingRecords.length, 6);

	await t.context.mongodb.remove('first', { _id: existingRecords[0]._id });

	t.is((await t.context.db.collection('first').find({}).toArray()).length, 5);
});

test.serial('deletes records by string value', async t => {
	t.is((await t.context.db.collection('first').find({}).toArray()).length, 5);

	await t.context.mongodb.remove('first', { foo: 'baz' });

	t.is((await t.context.db.collection('first').find({}).toArray()).length, 4);
});

test.serial('deletes records by numerical value', async t => {
	t.is((await t.context.db.collection('first').find({}).toArray()).length, 4);

	await t.context.mongodb.remove('first', { baz: 3 });

	t.is((await t.context.db.collection('first').find({}).toArray()).length, 3);
});

test.serial('deletes all records', async t => {
	t.is((await t.context.db.collection('first').find({}).toArray()).length, 3);

	await t.context.mongodb.remove('first', {});

	t.is((await t.context.db.collection('first').find({}).toArray()).length, 0);
});

test.serial('deletes nothing in a non-existent collection', async t => {
	const result = await t.context.mongodb.remove('fourth', {});

	t.is(result.result.ok, 1);
	t.is(result.result.n, 0);
});


test.after.always(async t => {
	await t.context.client.connect();
	await t.context.db.dropDatabase();
	await t.context.client.close();
});
