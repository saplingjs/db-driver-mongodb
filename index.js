/**
 * MongoDB driver for Sapling
 */


/* Dependencies */
import { MongoClient, ObjectId } from 'mongodb';
import Interface from '@sapling/sapling/drivers/db/Interface.js';
import { console } from '@sapling/sapling/lib/Cluster.js';

/* Default values */
const HOST = 'localhost';
const PORT = 27017;

/* Default options for each type of operation */
const mongoOptions = {
	open: {},
	collection: {},
	insert: {},
	update: { upsert: false, multi: true },
	find: {},
};

export default class Mongo extends Interface {
	/**
	 * The MongoClient instance
	 */
	client = null;

	/**
	 * The selected database instance
	 */
	database = null;

	/**
	 * Name of the database to be selected
	 */
	databaseName = null;


	/**
	 * Convert all "_id" fields with a string representation of an object ID
	 * to the appropriate MongoDB object ID object
	 *
	 * @param {object} conditions Search query object
	 */
	convertObjectId(conditions) {
		if (conditions._id) {
			try {
				conditions._id = new ObjectId(conditions._id);
			} catch {}
		}

		return conditions;
	}


	/**
	 * Establish a connection to the database server
	 *
	 * @param {object} config {name: Name of the database, host: Host IP, port: Port number}
	 */
	async connect({ name, host, port }) {
		/* Setup the Mongo connection */
		this.client = new MongoClient(`mongodb://${host || HOST}:${port || PORT}`, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});

		/* Set the given database (actually select it in open()) */
		this.databaseName = name;
		await this.open();

		return true;
	}


	/**
	 * Open a connection and select the database
	 */
	async open() {
		this.connection = await this.client.connect();
		this.database = await this.client.db(this.databaseName);
	}


	/**
	 * Close a connection
	 */
	async close() {
		return await this.client.close();
	}


	/**
	 * Create a collection in the database where one doesn't yet exist
	 *
	 * @param {string} name Name for the collection being created
	 * @param {array} fields Model object
	 */
	async createCollection(name, fields) {
		console.log('CREATE COLLECTION', name, fields);
		await this.open();

		const collection = await this.database.createCollection(name, mongoOptions.open);

		await this.close();

		return collection;
	}


	/**
	 * Create an index for the specified fields
	 *
	 * @param {string} name Name of the target collection
	 * @param {object} fields Object of indices to create.  Key is field name, value is index type, e.g. 'unique'
	 */
	async createIndex(name, fields) {
		console.log('CREATE INDEX', name, fields);
		await this.open();

		/* Select the given collection */
		const collection = await this.database.collection(name, mongoOptions.collection);

		const indices = [];

		/* Create an index for the given field(s) */
		for (const field of Object.keys(fields)) {
			if (fields[field] === 'unique') {
				indices.push(await collection.createIndex({ [field]: 1 }, { unique: true }));
			} else {
				indices.push(await collection.createIndex({ [field]: 1 }));
			}
		}

		await this.close();

		return indices;
	}


	/**
	 * Find one or more records for the given conditions in the given collection
	 *
	 * @param {string} name Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} options Driver specific options for the operation
	 */
	async read(name, conditions, options, references) {
		console.log('READ', name, conditions);
		await this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* Get the collection */
		const collection = await this.database.collection(name, mongoOptions.collection);

		/* Aggregation stack */
		const stack = this.createStack(conditions, references);

		/* Do it */
		const result = await collection.aggregate(stack, options).toArray();

		await this.close();

		return result;
	}


	/**
	 * Create one new records in the given collection
	 *
	 * @param {string} name Name of the target collection
	 * @param {object} data Data for the collection
	 */
	async write(name, data) {
		console.log('WRITE', name, data);
		await this.open();

		/* Select the given collection */
		const collection = await this.database.collection(name, mongoOptions.collection);

		/* Coerce into an array */
		if (Array.isArray(data) === false) {
			data = [data];
		}

		/* Create a new record with the data */
		const result = await collection.insertMany(data, mongoOptions.insert);

		await this.close();

		return result;
	}


	/**
	 * Modify the given values in data in any and all records matching the given conditions
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 * @param {object} data New data for the matching record(s). Omitted values does not imply deletion.
	 */
	async modify(name, conditions, data) {
		console.log('MODIFY', name, conditions, data);
		await this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* For any reference constraints, create a proper object ID object */
		for (const i in conditions.references) {
			if (Object.prototype.hasOwnProperty.call(conditions.references, i)) {
				const reference = conditions.references[i];
				if (data[reference]) {
					data[reference] = new ObjectId(data[reference]);
				}
			}
		}

		/* Remove the raw references */
		delete conditions.references;

		/* Select the given collection */
		const collection = await this.database.collection(name, mongoOptions.collection);

		/* Update the given record with new data */
		const result = await collection.updateMany(conditions, { $set: data }, mongoOptions.update);

		await this.close();

		return result;
	}


	/**
	 * Delete any and all matching records for the given conditions
	 *
	 * @param {string} collection Name of the target collection
	 * @param {object} conditions The search query
	 */
	async remove(name, conditions) {
		console.log('REMOVE', name, conditions);
		await this.open();

		/* If there is an _id field in constraints, create a proper object ID object */
		conditions = this.convertObjectId(conditions);

		/* Select the given collection */
		const collection = await this.database.collection(name, mongoOptions.collection);

		/* Delete the given records */
		const result = await collection.deleteMany(conditions, mongoOptions.remove);

		await this.close();

		return result;
	}


	/**
	 * Parse Sapling conditions into a MongoDB filter stack
	 *
	 * @param {object} conditions Conditions from Storage
	 * @param {objects} references References
	 * @returns Stack for MongoDB
	 */
	createStack(conditions, references) {
		const stack = [
			{
				$match: {},
			},
		];

		/* Filter conditions for MongoDB */
		for (const condition in conditions) {
			if (Object.prototype.hasOwnProperty.call(conditions, condition)) {
				if (Array.isArray(conditions[condition])) {
					stack[0].$match[condition] = { $in: conditions[condition].map(cond => {
						if (String(conditions[condition]).includes('*')) {
							return new RegExp(`^${cond.split('*').join('(.*)')}$`, 'gmi');
						}

						return cond;
					}) };
				} else if (String(conditions[condition]).includes('*')) {
					stack[0].$match[condition] = { $regex: new RegExp(`^${conditions[condition].split('*').join('(.*)')}$`, 'gmi') };
				} else {
					stack[0].$match[condition] = conditions[condition];
				}
			}
		}

		/* Handle reference fields if we have any */
		for (const reference in references) {
			if (Object.prototype.hasOwnProperty.call(references, reference)) {
				stack.push({
					$lookup: references[reference],
				});
			}
		}

		return stack;
	}
}
