import express from 'express';
import { body, validationResult } from 'express-validator';
import { models } from '../database/models.js';
import { Worker } from 'node:worker_threads';
import debug from 'debug';
import { fileURLToPath } from 'node:url';

const d = debug('router:admin');

const adminRouter = express.Router();

adminRouter.get('/', (req, res, next) => {
  res.render('admin-login', { layout: false });
});

adminRouter.post('/authenticate', (req, res, next) => {
  // res.render('admin-login', { layout: false, usernameNotValid: true });
  req.session.name = 'vishal';
  req.session.post = 'clerk';
  res.redirect('/admin/home');
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
    post: req.session.post
  });
});


// ------- /customer Routes start --------------

adminRouter.get('/customer/table', (req, res, next) => {
  res.render('admin-customer-list', {
    loginname: req.session.name,
    post: req.session.post, customerList: true
  });
});

adminRouter.get('/customer/info', async (req, res, next) => {

  try {

    const row = await models.customer.findOne({
      where: {
        ug_number: req.query?.ugnumber.toUpperCase(),
      },
      include: [models.subscription, models.contact]
    })
    res.status(200).send(row.toJSON());

  } catch (err) {

    res.status(500).json({ err });

  }
});

adminRouter.get('/customer/list', (req, res, next) => {
  const find = new Worker(fileURLToPath(new URL('./findAllCustomer.worker.js', import.meta.url)),
    {
      workerData: {
        attributes: ['ug_number', 'first_name', 'last_name'],
        include: [{
          model: 'subscription',
          attributes: ['remaining_days', 'renew_date']
        }],
      }
    });

  find.on('message', (result) => {
    res.status(200).json({ "data": result });
  });

  find.on('error', (err) => {
    res.status(500).json({ err: err.message });
  });

  find.on('messageerror', (err) => {
    res.status(400).json({ err: err.message });
  })

  req.on('close', () => find.emit('exit'));
});

adminRouter.get('/customer/exists', async (req, res, next) => {
  try {
    const ugnumber = await models.customer.findByPk(req.query?.ugnumber.toUpperCase());
    if (ugnumber)
      res.status(200).json({ exists: true });
    else
      res.status(200).json({ exists: false });
  } catch (err) {
    res.status(500).json({ err });
  }
});

adminRouter.route('/customer/add')
  .get((req, res, next) => {
    res.render('admin-add-customer', {
      loginname: req.session.name,
      post: req.session.post, addCustomer: true
    });
  })
  .post(
    // validations
    body('ugnumber').isAlphanumeric().notEmpty().trim().escape(),
    body('firstname').notEmpty().isAlpha().trim().escape(),
    body('surname').notEmpty().isAlpha().trim(),
    body('email').isEmail().normalizeEmail().trim(),
    body('phone').isNumeric().notEmpty().trim(),
    body('guardianFirstname').notEmpty().isAlpha().trim(),
    body('guardianSurname').notEmpty().isAlpha().trim(),
    body('guardianPhone').isNumeric().notEmpty().trim(),
    body('joinDate').isDate().notEmpty().trim(),
    body('address').notEmpty().trim(),
    body('messType').notEmpty().trim(),
    body('messPlan').notEmpty().trim(),
    body('payamount').notEmpty().isNumeric().trim(),
    body('paydate').notEmpty().isDate().trim(),
    body('paymode').notEmpty().trim(),

    async (req, res, next) => {

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).render('admin-add-customer', {
          insertFail: true, message: errors.array().map(e => e.param + ':' + e.value).join('<br>')
        });
        console.table(errors.array());
        return;
      }


      if (req.body.messPlan === 'one-month') {
        req.body.messPlan = 30;
      } else {
        req.body.messPlan = Number(req.body.messPlan);
      };

      try {

        process.nextTick(() => { });

        const customer = await models.customer.create({
          ug_number: req.body.ugnumber,
          first_name: req.body.firstname,
          last_name: req.body.surname,
          joining_date: req.body.joinDate,
          guardian_firstname: req.body.guardianFirstname,
          guardian_surname: req.body.guardianSurname,

          Contact: {
            email: req.body.email,
            phone: req.body.phone,
            address: req.body.address,
            guardian_phone: req.body.guardianPhone,
          },

          Subscription: {
            number_of_days: req.body.messPlan,
            sub_type: req.body.messType,
            renew_date: req.body.joinDate,
            remaining_days: req.body.messPlan,
            status: 'active',
          },

          Payments: [{
            payment_date: req.body.paydate,
            amount: req.body.payamount,
            mode: req.body.paymode,
            txnid: req.body.txnid,
          }],
        }, { include: [models.contact, models.subscription, models.payment] });

        res.render('admin-add-customer', {
          insertSuccess: true,
          message: 'Customer Added Successfully'
        });

      } catch (err) {

        res.render('admin-add-customer', {
          insertFail: true,
          message: err.toString()
        });
        return;
        next(err);
      }
    });



adminRouter.get('/customer/update', (_req, res, next) => {
  res.render('admin-update-customer');
});

adminRouter.post('/customer/update/profile',
  // validations
  body('ugnumber').isAlphanumeric().notEmpty().trim().escape(),
  body('firstname').notEmpty().isAlpha().trim().escape(),
  body('surname').notEmpty().isAlpha().trim(),
  body('email').isEmail().normalizeEmail().trim(),
  body('phone').isNumeric().notEmpty().trim(),
  body('guardianFirstname').notEmpty().isAlpha().trim(),
  body('guardianSurname').notEmpty().isAlpha().trim(),
  body('guardianPhone').isNumeric().notEmpty().trim(),
  body('joinDate').isDate().notEmpty().trim(),
  body('address').notEmpty().trim(),
  body('messType').notEmpty().trim(),
  body('messPlan').notEmpty().trim(),

  async (req, res, next) => {

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).render('admin-update-form', {
        updateFail: true, message: errors.array().map(e => e.param + ':' + e.value).join('<br>')
      });
      console.table(errors.array());
      return;
    }

    try {

      process.nextTick(() => { });

      const customer = await models.customer.findOne({
        where: { ug_number: req.query.ugnumber },
        include: [models.contact, models.subscription]
      });

      customer.set({
        ug_number: req.body.ugnumber,
        first_name: req.body.firstname,
        last_name: req.body.surname,
        joining_date: req.body.joinDate,
        guardian_firstname: req.body.guardianFirstname,
        guardian_surname: req.body.guardianSurname,
      });

      customer.Contact.set({
        email: req.body.email,
        phone: req.body.phone,
        address: req.body.address,
        guardian_phone: req.body.guardianPhone,
      });

      customer.Subscription.set({
        number_of_days: req.body.messPlan,
        sub_type: req.body.messType,
        renew_date: req.body.joinDate,
        remaining_days: req.body.messPlan,
      })

      await Promise.all([
        customer.save(),
        customer.Contact.save(),
        customer.Subscription.save()
      ]);

      console.log(customer.toJSON());

      res.render('admin-update-customer', {
        success: true,
        message: 'Update Successfull'
      });

    } catch (err) {

      res.render('admin-update-customer', {
        err: true,
        message: err.toString()
      });
      // next(err);
    }
  });



adminRouter.get('/customer/update/show', async (req, res, next) => {

  const ugnumber = req.query?.ugnumber.toUpperCase();

  if (!ugnumber) {
    res.status(400).render('admin-update-customer', {
      err: true,
      message: 'UG number not Given'
    });
    return;
  }

  try {

    const data = await models.customer.findOne({
      where: {
        ug_number: ugnumber,
      },
      include: [models.contact, models.subscription, models.payment]
    });

    if (data.dataValues.Subscription.sub_type === 'lunch') {
      data.dataValues.Subscription.single = true;
    }

    if (data.dataValues.Subscription.sub_type === 'lunch-dinner') {
      data.dataValues.Subscription.both = true;
    }

    if (data.dataValues.Subscription.status === 'active') {
      data.dataValues.Subscription.active = true;
    }

    if (data.dataValues.Subscription.status === 'inactive') {
      data.dataValues.Subscription.inactive = true;
    }

    res.render('admin-update-form', { data: data.dataValues });

  } catch (err) {
    console.error(err);
  }

});

adminRouter.get('/customer/payments', (req, res, next) => {
  res.status(200).render('admin-customer-payments');
});

adminRouter.get('/customer/payments/show', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber.toUpperCase();

  if (!ugnumber) {
    res.status(400).render('admin-customer-payments', {
      err: true,
      message: 'UG number not Provided'
    });
    return;
  }

  try {

    const data = await models.customer.findOne({
      where: {
        ug_number: ugnumber,
      },
    });

    res.render('admin-payments-table', { ugnumber, data: data.dataValues });

  } catch (err) {

    next(err);

  }

});

adminRouter.get('/customer/payments/list', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber.toUpperCase();

  if (!ugnumber) {
    res.status(400).render('admin-customer-payments', {
      err: true,
      message: 'UG number not Provided'
    });
    return;
  }

  try {

    const data = await models.customer.findOne({
      where: {
        ug_number: ugnumber,
      },
      include: [models.payment]
    });

    res.status(200).json({ "data": data.Payments.map(payment => payment.toJSON()) });

  } catch (err) {

    next(err);

  }
});

// --------- /customer Routes End ----------


// ---------- /guest Routes Start -----------

adminRouter.get('/guest', (_req, res, next) => {
  res.render('admin-guest');
});

adminRouter.post('/guest/add',
  body('name').notEmpty().trim(),
  body('email').isEmail().trim(),
  body('payamount').notEmpty().isNumeric().trim(),
  body('paydate').isDate().trim(),
  body('paymode').notEmpty().trim(),
  async (req, res, next) => {

    const erros = validationResult(req);

    if (!erros.isEmpty()) {

      res.render('admin-guest', {
        insertFail: true,
        message: erros.array().map(err => err.msg + ':' + err.param)
      });
      return;

    }

    try {

      const result = await models.guest.create({
        name: req.body.name,
        email: req.body.email,
        payamount: req.body.payamount,
        paydate: req.body.paydate,
        paymode: req.body.paymode,
        txnid: req.body.txnid
      });

      res.render('admin-guest', { insertSuccess: true, message: 'guest added successfully' });

    } catch (err) {

      res.render('admin-guest', { insertFail: true, message: err.message });
    }

  });

export default adminRouter;

// --------- /guest routes -----------

// --------- /attendance -----------

adminRouter.get('/attendance', (req, res, next) => {
  res.render('admin-attendance');
});
