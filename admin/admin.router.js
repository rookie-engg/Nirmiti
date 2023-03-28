import express from 'express';
import debug from 'debug';
import customerRouter from './routes/customer.router.js';
import guestRouter from './routes/guest.router.js';
import attendanceRouter from './routes/attendance.router.js';
import subscriptionRouter from './routes/subscription.router.js';
import reportsRouter from './routes/reports.router.js';

const d = debug('router:admin');

const adminRouter = express.Router();

adminRouter.get('/', (req, res, next) => {
  res.render('admin-login', { layout: false });
});

adminRouter.post('/authenticate', async (req, res, next) => {
  // res.render('admin-login', { layout: false, usernameNotValid: true });
  req.session.name = 'vishal';
  req.session.post = 'clerk';
  res.redirect('/admin/attendance');
});

adminRouter.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

adminRouter.use((req, res, next) => {
  if (!req.session?.name || !req.session?.post) {
    req.session.destroy(() => {
      res.redirect('/admin');
    });
    return;
  }
  next();
});

adminRouter.get('/home', (req, res, next) => {
  res.render('admin-home', {
    loginname: req.session.name,
    post: req.session.post,
    title: 'Home'
  });
});

adminRouter.get('/profile', (req, res, next) => {
  res.render('admin-profile', {
    loginname: req.session.name,
    post: req.session.post,
    title: 'Admin Profile'
  });
});


// ------- /customer Routes------------
adminRouter.use('/customer', customerRouter);

// ---------- /guest Routes------------
adminRouter.use('/guest', guestRouter);

// --------- /attendance --------------
adminRouter.use('/attendance', attendanceRouter);

// --------- /subscription ------------
adminRouter.use('/subscription', subscriptionRouter);

// -------- /reports ---------------
adminRouter.use('/reports', reportsRouter);

export default adminRouter;
