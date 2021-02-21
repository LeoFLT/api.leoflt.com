import MongoClient from 'mongodb';
const url = 'mongodb://127.0.0.1:27017';
const database = 'api';
const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true }).catch(console.log);
const db = client.db(database);

export async function queryCollection(collection, query) {
    if (!client) return;
    try {
        let mongoCollection = db.collection(collection);
        let result = await mongoCollection.find(query).toArray();
        return result;
    } catch (e) {
        console.log(e);
    }
}

export async function insertCollection(collection, toInsert) {
    try {
        let mongoCollection = db.collection(collection);
        let result = await mongoCollection.insertOne(toInsert);
        return result;
    } catch (e) {
        console.log(e);
    }
}

export async function updateCollection(collection, toUpdate, queryId) {
    try {
        let mongoCollection = db.collection(collection);
        let result = await mongoCollection.updateOne(toUpdate, { $inc: { times_ran: 1 }, $push: { update_history: { timestamp: new Date(), queried_id: queryId } } });
        return result;
    } catch (e) {
        console.log(e);
    }
}