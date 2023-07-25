import express from 'express';
import morgan from 'morgan';
import createError from 'http-errors';
import { fileURLToPath } from 'node:url';
import nodeSassMiddleware from 'node-sass-middleware';
import cookieParser from 'cookie-parser';
import dbInstance from './database/connect.js';
import { config } from 'dotenv';
import adminRouter from './admin/admin.router.js';
import expressSession from 'express-session';
import debug from 'debug';
import { insertDummyData } from './insertDummyData.js';
import { models } from './database/models.js';

config();

const dseq = debug('sequelize:pool');
const app = express();
const logger = morgan('dev');
// const createHttpError = httpError;

// syncing database models
// await dbInstance.drop();
dseq('Database authenticated');
// await dbInstance.sync();
// await insertDummyData(500);

app.set('env', 'development');
app.set('views', fileURLToPath(new URL('./views', import.meta.url)));
app.set('view engine', 'hbs');

// app.use(logger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(expressSession({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
app.use(cookieParser());
app.use(nodeSassMiddleware({
  src: fileURLToPath(new URL('./public', import.meta.url)),
  dest: fileURLToPath(new URL('./public', import.meta.url)),
  indentedSyntax: false, // true = .sass and false = .scss
  sourceMap: true,
}));

app.use('/admin/public', express.static(fileURLToPath(new URL('./admin/public', import.meta.url))));

app.use('/admin', adminRouter);

app.use('/', (req, res, next) => {
  // res.send('<h1>CLient HOME</h1>');
  res.redirect('/admin/attendance');
});

app.use((_req, _res, next) => {
  next(createError(404));
});

app.use((err, req, res, _next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

export default app;
