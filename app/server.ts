import 'dotenv/config';
import path from 'path';
import express from 'express';
import { noSniff } from 'helmet';
import { AppConfig } from 'environment';
import { MemoryStore } from 'express-session';

import app from "./app";

const expressApp = express();
expressApp.use(noSniff());

expressApp.use('/css', express.static(path.resolve(__dirname, './public/css')));
expressApp.use('/assets/js', express.static(path.resolve(__dirname, './public/javascript')));
expressApp.use('/assets/images', express.static(path.resolve(__dirname, './public/images')));
expressApp.use('/assets/fonts', express.static(path.resolve(__dirname, './public/fonts')));

const appConfig = { ...process.env as AppConfig };
const name = appConfig.SESSION_ID;
const secret = appConfig.SESSIONS_SECRET;
const ttl = parseInt(appConfig.SESSIONS_TTL_SECONDS);
const secure = appConfig.SECURE_COOKIES === 'true';
const port = parseInt(appConfig.SERVER_PORT);

const sessionStore = new MemoryStore();

const addressApp = app(name, secret, ttl, secure, sessionStore);

expressApp.use('/', addressApp);

expressApp.listen(port, () => {
  console.log(`running on port: ${port}`);
});
