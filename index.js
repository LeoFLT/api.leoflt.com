import fs from 'fs';
import cors from 'cors';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import express from 'express';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { insertCollection, queryCollection, updateCollection } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const privKey = fs.readFileSync('/etc/letsencrypt/live/api.leoflt.com/privkey.pem');
const pubCert = fs.readFileSync('/etc/letsencrypt/live/api.leoflt.com/fullchain.pem');

const server = express();
const port = { http: 80, https: 443 };
server.use(cors());
server.enable('trust proxy');
server.disable('x-powered-by');

server.use((req, res, next) => {
    if (!req.secure) {
        return res.redirect(`https://${req.headers.host}${req.url}`)
    }
    next();
});

// the order for the routes matter, last route is the 404 on purpose so that it default to that
server.put('/users/add', async (req, res) => {
    res.set('Content-Type', 'application/json');
    if (req.header('Username') && req.header('User-ID')) {
        let username = req.header('Username');
        let userId = req.header('User-ID');
        let apiKey = crypto.randomBytes(20).toString('hex');

        let userToInsert = (await queryCollection('api_keys', { 'user_id': userId }))[0];
        if (userToInsert) {
            delete userToInsert._id;
            delete userToInsert.created_at;
            res.status(200).send(userToInsert);
        } else {
            let insert = await insertCollection('api_keys', { 'username': username, 'user_id': userId, 'api_key': apiKey, created_at: new Date() });
            delete insert.ops[0]._id;
            delete insert.ops[0].created_at;
            res.status(200).send(insert.ops[0]);
        }
    }
    else res.status(401).send({ authorization: 'basic' });
});

server.get('/get_user', async (req, res) => {
    const noApiKey = { error: 'Please provide a valid API key.' };
    // no property 'k' in req.query = error: invalid api key
    const keyIsValid = (await queryCollection('api_keys', { 'api_key': req.query.k }))[0];
    if (keyIsValid) {
        // no property 'u' in req.query = return empty array (default osu! api behavior)
        if (req.query.hasOwnProperty('u')) {
            try {
                let returnPlayer = (await queryCollection('users', { 'user_id': req.query.u }))[0];
                if (returnPlayer) delete returnPlayer._id;
                updateCollection('api_keys', { 'api_key': req.query.k }, req.query.u);
                res.status(200).send([returnPlayer]);
            } catch (e) {
                res.status(200).send([]);
            }
        }
        else {
            updateCollection('api_keys', { 'api_key': req.query.k }, null);
            res.status(200).send([])
        };
    }
    else res.status(401).send(noApiKey);
})

server.get('/admin/get_queries', async (req, res) => {
    const noApiKey = { error: 'Please provide a valid API key.' };
    if (!req.query.k) res.status(401).send(noApiKey);
    const keyIsValid = (await queryCollection('api_keys', { 'api_key': req.query.hasOwnProperty('k') ? req.query.k : null }))[0];
    if (keyIsValid) {
        if (keyIsValid.user_id === '3668779' || keyIsValid.user_id === '8599070') {
            let returnPlayers = await queryCollection('api_keys', {});
            let returnArray = [];
            for (let player of returnPlayers) {
                if (!player) continue;
                if (!req.query.hasOwnProperty('show_keys')) {
                    delete player.api_key;
                }
                else if (req.query.show_keys === false || req.query.show_keys === 'false') {
                    delete player.api_key;
                }
                delete player._id;
                returnArray = [...returnArray, player];
            }
            res.status(200).send(returnArray);
        }
        else res.status(401).send({ error: 'forbidden' });
    }
    else res.status(401).send(noApiKey);
});

server.get('/avatar', async (req, res) => {
    let imageId = Object.keys(req.query).length > 0 ? Object.keys(req.query).pop() : null;
    let query = (await queryCollection('users', { user_id: imageId }))[0];
    let imageUrl = query ? query.avatar_url : 'https://a.ppy.sh';
    
    res.redirect(imageUrl);
});

// root
server.get('/', (req, res) => {
    res.status(403).send();
});

// default route
server.use((req, res) => {
    res.status(404).sendFile(__dirname + '/404.html');
});

const httpServer = http.createServer(server);
const httpsServer = https.createServer({
    key: privKey,
    cert: pubCert
}, server);

httpServer.listen(port.http, () => console.log(`Listening for HTTP requests to redirect to HTTPS (${port.http} => ${port.https})`));
httpsServer.listen(port.https, () => console.log(`Listening for HTTPS requests on port ${port.https}`));