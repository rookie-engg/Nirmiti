import express from 'express';
import { body, validationResult } from 'express-validator';
import { models } from '../database/models.js';
import { Worker } from 'node:worker_threads';
import debug from 'debug';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';

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
    body('remaningAmount').notEmpty().isFloat(),
    body('payamount').notEmpty().isNumeric().trim(),
    body('paydate').notEmpty().isDate().trim(),

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
            total_amount: req.body.payamount,
            paid_amount: req.body.paidAmount,
            cash: req.body.cash,
            online: req.body.online,
            remaning_amount: req.body.remaningAmount,
            status: req.body?.remaningAmount ? 'pending' : 'complete',
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

  const ugnumber = req.query?.ugnumber;

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
        ug_number: ugnumber.toUpperCase(),
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
  const ugnumber = req.query?.ugnumber;

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
        ug_number: ugnumber.toUpperCase(),
      },
    });

    res.render('admin-payments-table', { ugnumber, data: data.dataValues });

  } catch (err) {

    next(err);

  }

});

adminRouter.get('/customer/payments/list', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;

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
        ug_number: ugnumber.toUpperCase(),
      },
      include: [models.payment]
    });

    res.status(200).json({ "data": data.Payments.map(payment => payment.toJSON()) });

  } catch (err) {

    next(err);

  }
});

adminRouter.get('/customer/payments/update', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;

  if (!ugnumber) {
    res.status(400).render('admin-customer-payments', {
      err: true,
      message: 'UG number not Provided'
    });
    return;
  }

  const id = req.query?.id;

  if (!id) {
    res.status(400).render('admin-customer-payments', {
      err: true,
      message: 'Payment ID not Provided'
    });
    return;
  }

  try {

    const customer = await models.customer.findOne({
      where: {
        ug_number: ugnumber.toUpperCase(),
      },
      include: [models.payment],
    });

    const payment = await customer.getPayments({ where: { id } });

    if (!payment.length > 0) {
      res.status(400).render('admin-customer-payments', {
        err: true,
        message: 'Payment ID not Valid'
      });
      return;
    }

    res.status(200).render('admin-payment-form', {
      id, ugnumber,
      data: payment.map(p => p.toJSON()).at(0),
      paymentComplete: payment[0].dataValues.status === 'complete' ? true : false,
      paymentPending: payment[0].dataValues.status === 'pending' ? true : false,
    });

  } catch (err) {

    res.status(500).render('admin-customer-payments', {
      err: true,
      message: err.message
    });

  }
});

adminRouter.post('/customer/payment/update',
  body('id').notEmpty(),
  body('ugnumber').notEmpty(),
  body('payamount').notEmpty().isFloat(),
  body('paidAmount').notEmpty().isFloat(),
  body('remaningAmount').notEmpty().isFloat(),
  body('paydate').isDate(),
  async (req, res, next) => {

    const customer = await models.customer.findOne({
      where: { ug_number: req.body.ugnumber }
    });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).render('admin-payments-table', {
        err: true,
        message: errors.array().map(e => e.param + ':' + e.value).join(' <br> '),
        data: customer.dataValues,
        ugnumber: customer.dataValues.ug_number
      });
      console.table(errors.array());
      return;
    }


    try {
      const payments = await customer.getPayments({
        where: {
          id: req.body.id
        }
      });

      if (payments.length != 1) {
        throw Error('Invalid Payment ID recieved');
      }

      const payment = payments[0];

      payment.set({
        payment_date: req.body.paydate,
        total_amount: req.body.payamount,
        paid_amount: req.body.paidAmount,
        status: req.body.status,
        online: req.body.online,
        cash: req.body.cash,
        txnid: req.body.txnid,
      });

      await payment.save();

      res.status(200).render('admin-payments-table', {
        success: true,
        message: 'Payment with ID ' + req.body.id + ' update Successful',
        data: customer.dataValues,
        ugnumber: customer.dataValues.ug_number
      });

    } catch (err) {
      res.status(500).render('admin-payments-table', {
        err: true,
        message: err.message,
        data: customer.dataValues,
        ugnumber: customer.dataValues.ug_number
      });
    }

  });


// --------- /customer Routes End ----------


// ---------- /guest Routes Start -----------

adminRouter.get('/guest/add', (_req, res, next) => {
  res.render('admin-guest');
});

adminRouter.get('/guest/table', (req, res, next) => {
  res.render('admin-guest-table');
});

adminRouter.get('/guest/list', async (req, res, next) => {
  try {
    const guests = await models.guest.findAll();
    res.status(200).json({ data: guests.map(guest => guest.toJSON()) });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

adminRouter.get('/guest/delete', async (req, res, next) => {
  if (!req.query?.id) {
    res.status(400).render('admin-guest-table', { err: true, message: 'Invalid Id given' });
    return;
  }

  try {
    await models.guest.destroy({ where: { id: req.query.id } });
    res.status(200).render('admin-guest-table', { success: true, message: 'Delete Success' });
  } catch (err) {
    res.status(500).render('admin-guest-table', { err: true, message: err.message });
  }

});

adminRouter.post('/guest/add',
  body('name').notEmpty().trim(),
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


// --------- /guest routes -----------

// --------- /attendance -----------

adminRouter.get('/attendance', (req, res, next) => {
  res.render('admin-attendance');
});

adminRouter.get('/attendance/mark', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;

  if (!ugnumber) {
    res.render('admin-attendance', { err: true, message: 'Invalid UG Number' });
    return;
  }

  let currentDateTimeISO = req.query?.currentDateTimeISO;
  if (!currentDateTimeISO) {
    res.render('admin-attendance', { err: true, message: 'Invalid Current Date TIme ISO' });
    return;
  }

  try {
    const customer = await models.customer.findOne({
      where: { ug_number: ugnumber.toUpperCase() },
      include: [models.subscription, models.activity]
    });

    if (!customer) {
      res.status(200).render('admin-attendance', {
        err: true,
        message: `Reg Number ${ugnumber} Does't exists`
      });
      return;
    }
    const remaningDays = Number.parseFloat(customer.Subscription.remaining_days);
    if (remaningDays <= 0) {
      res.render('admin-attendance', {
        modal: true,
        message: ugnumber.toString() + ' Subscription Expired Please Re-new',
      });
      return;
    }

    const status = customer.Subscription.status;
    if (status === 'inactive') {
      res.render('admin-attendance', {
        modal: true,
        message: ugnumber.toString() + 'Has Status:"IN-ACTIVE" Please Set status active',
      });
      return;
    }

    const subType = customer.Subscription.sub_type;
    const dateNow = DateTime.fromISO(DateTime.fromISO(currentDateTimeISO).toISODate());
    console.log(dateNow.toISODate());

    let lastDate = customer.Activity.last_active;
    let lastCount = customer.Activity.last_count;
    if (!lastDate) {
      // set last date to previous date 
      lastDate = dateNow.minus({ day: 1 });
    }
    if (!lastCount) {
      lastCount = 0;
    }

    lastDate = DateTime.fromISO(lastDate);
    lastCount = Number.parseInt(lastCount);

    // same day
    if (dateNow.equals(lastDate)) {
      // if daily quota is exausted for single time customer
      if (subType === 'single' && lastCount == 1) {
        res.render('admin-attendance', {
          modal: true,
          message: `Attendance already marked!\n Daily Quota Over For ${ugnumber} SINGLE TIME`
        });
        return;
      }
      // if daily quota is exausted for both lunch & dinner customer
      if (subType === 'both' && lastCount == 2) {
        res.render('admin-attendance', {
          modal: true,
          message: `Daily Quota Over For ${ugnumber} BOTH times`,
        })
        return;
      }

      // mark attendance for single time customer
      if (subType === 'single' && lastCount === 0) {
        lastCount = 1;
        customer.Activity.set({ last_count: lastCount });

        // reduce remaning days by 1
        const remaningDays = Number.parseFloat(customer.Subscription.remaining_days);
        customer.Subscription.set({ remaining_days: remaningDays - 1 });

        await Promise.all([customer.Subscription.save(), customer.save(), customer.Activity.save()]);

        res.render('admin-attendance', {
          success: true,
          message: 'Attenedance Marked for ' + ugnumber,
        });
        return;
      }

      // mark attendance for both time customer
      if (subType === 'both') {
        const lunchTime = DateTime.fromISO(currentDateTimeISO).set({ hour: 12, minute: 0, second: 0 });
        const dinnerTime = DateTime.fromISO(currentDateTimeISO).set({ hour: 18, minute: 0, second: 0 });
        const dateTimeNow = DateTime.fromISO(currentDateTimeISO);

        if ((lunchTime < dateTimeNow < dinnerTime) && lastCount == 1) {
          res.render('admin-attendance', {
            modal: true,
            message: 'Already Attendance Mark for Lunch time for ' + ugnumber,
          });
          return;
        }

        if ((dinnerTime < dateTimeNow) && lastCount == 2) {
          res.render('admin-attendance', {
            modal: true,
            message: 'Already Attendance Mark for Dinner time for ' + ugnumber,
          });
          return;
        }
        lastCount = lastCount + 1;
        customer.Activity.set({ last_count: lastCount });

        // reduce remaning days by 1
        const remaningDays = Number.parseFloat(customer.Subscription.remaining_days);
        customer.Subscription.set({ remaining_days: remaningDays - 0.5 });

        await Promise.all([customer.Subscription.save(), customer.save(), customer.Activity.save()]);

        res.render('admin-attendance', {
          success: true,
          message: 'Attenedance Marked for ' + ugnumber,
        });
        return;

      }
    }
    // new day
    else {
      lastCount = 1;
      lastDate = dateNow;
      customer.Activity.set({ last_count: lastCount, last_active: dateNow.toISODate() });

      const remaningDays = Number.parseFloat(customer.Subscription.remaining_days);

      if (subType === 'single') {
        customer.Subscription.set({ remaining_days: remaningDays - 1 });
      } else {
        customer.Subscription.set({ remaining_days: remaningDays - 0.5 });
      }

      await Promise.all([customer.Subscription.save(), customer.save(), customer.Activity.save()]);

      res.render('admin-attendance', {
        success: true,
        message: 'Attenedance Marked for ' + ugnumber,
      });
      return;
    }

  } catch (err) {
    console.error(err);
    res.status(500).render('admin-attendance', { err: true, message: err.message });
  }
});

export default adminRouter;
