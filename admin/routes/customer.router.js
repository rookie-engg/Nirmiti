import express from 'express';
import { body, validationResult, query } from 'express-validator';
import { models } from '../../database/models.js';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { Op } from 'sequelize';

const customerRouter = express.Router();

customerRouter.use((req, res, next) => {
  res.customerRender = (template, options) => {
    res.render(template, {
      loginname: req.session.name,
      post: req.session.post,
      title: 'customer',
      ...options
    });
  }
  next();
});

customerRouter.get('/table', (req, res, next) => {
  res.customerRender('admin-customer-list');
});

customerRouter.get('/info', async (req, res, next) => {
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

customerRouter.get('/list', (req, res, next) => {
  try {
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
  } catch (err) {
    res.status(500).json({ err });
  }
});

customerRouter.get('/exists', async (req, res, next) => {
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

customerRouter.route('/add')
  .get((req, res, next) => {
    res.customerRender('admin-add-customer', {
      loginname: req.session.name,
      post: req.session.post, addCustomer: true
    });
  }).post(
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
        res.status(400).customerRender('admin-add-customer', {
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
            status: req.body.payamount == req.body.paidAmount ? 'complete' : 'pending',
            txnid: req.body.txnid,
          }],
        }, { include: [models.contact, models.subscription, models.payment] });

        res.customerRender('admin-add-customer', {
          insertSuccess: true,
          message: 'Customer Added Successfully'
        });

      } catch (err) {

        res.customerRender('admin-add-customer', {
          insertFail: true,
          message: err.toString()
        });
        return;
        next(err);
      }
    });



customerRouter.get('/update', (_req, res, next) => {
  res.customerRender('admin-update-customer');
});

customerRouter.post('/update/profile',
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
      res.status(400).customerRender('admin-update-form', {
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

      res.customerRender('admin-update-customer', {
        success: true,
        message: 'Update Successfull'
      });

    } catch (err) {

      res.customerRender('admin-update-customer', {
        err: true,
        message: err.toString()
      });
      // next(err);
    }
  });



customerRouter.get('/update/show', async (req, res, next) => {

  const ugnumber = req.query?.ugnumber;

  if (!ugnumber) {
    res.status(400).customerRender('admin-update-customer', {
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

    if (data.dataValues.Subscription.sub_type === 'single') {
      data.dataValues.Subscription.single = true;
    }

    if (data.dataValues.Subscription.sub_type === 'both') {
      data.dataValues.Subscription.both = true;
    }

    if (data.dataValues.Subscription.status === 'active') {
      data.dataValues.Subscription.active = true;
    }

    if (data.dataValues.Subscription.status === 'inactive') {
      data.dataValues.Subscription.inactive = true;
    }

    res.customerRender('admin-update-form', { data: data.dataValues });

  } catch (err) {
    res.status(404).send('<h1>User Not Found</h1>');
  }
});

customerRouter.get('/payments', (req, res, next) => {
  res.status(200).customerRender('admin-customer-payments');
});

customerRouter.get('/payments/show', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;

  if (!ugnumber) {
    res.status(400).customerRender('admin-customer-payments', {
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

    if (!data) {
      res.customerRender('admin-customer-payments', { err: true, message: 'Customer Not found with id ' + ugnumber });
      return;
    }

    res.customerRender('admin-payments-table', { ugnumber, data: data.dataValues });

  } catch (err) {

    next(err);

  }

});

customerRouter.get('/payments/list', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;

  if (!ugnumber) {
    res.status(400).customerRender('admin-customer-payments', {
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

customerRouter.route('/payments/update')
  .get(async (req, res, next) => {
    const ugnumber = req.query?.ugnumber;

    if (!ugnumber) {
      res.status(400).customerRender('admin-customer-payments', {
        err: true,
        message: 'UG number not Provided'
      });
      return;
    }

    const id = req.query?.id;

    if (!id) {
      res.status(400).customerRender('admin-customer-payments', {
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
        res.status(400).customerRender('admin-customer-payments', {
          err: true,
          message: 'Payment ID not Valid'
        });
        return;
      }

      res.status(200).customerRender('admin-payment-form', {
        id, ugnumber,
        data: payment.map(p => p.toJSON()).at(0),
        paymentComplete: payment[0].dataValues.status === 'complete' ? true : false,
        paymentPending: payment[0].dataValues.status === 'pending' ? true : false,
      });

    } catch (err) {

      res.status(500).customerRender('admin-customer-payments', {
        err: true,
        message: err.message
      });

    }
  }).post(
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
        res.status(400).customerRender('admin-payments-table', {
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

        res.status(200).customerRender('admin-payments-table', {
          success: true,
          message: 'Payment with ID ' + req.body.id + ' update Successful',
          data: customer.dataValues,
          ugnumber: customer.dataValues.ug_number
        });

      } catch (err) {
        res.status(500).customerRender('admin-payments-table', {
          err: true,
          message: err.message,
          data: customer.dataValues,
          ugnumber: customer.dataValues.ug_number
        });
      }

    });

customerRouter.route('/payments/bulk/show').get(
  query('startDate').isDate().trim(),
  query('endDate').isDate().trim(),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      res.status(400).customerRender('admin-customer-payments', {
        Berr: true,
        message: 'Please Provide Proper Query Prameters'
      });
      return;
    }

    res.status(200).customerRender('admin-bulk-payments-show', {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
  });

customerRouter.route('/payments/bulk/list').get(
  query('startDate').isDate().trim(),
  query('endDate').isDate().trim(),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      res.sendStatus(400);
      return;
    }
    try {
      const payments = await models.payment.findAll({
        where: {
          [Op.and]: [{
            payment_date: {
              [Op.between]: [req.query.startDate, req.query.endDate],
            }
          }]
        }
      });
      res.status(200).json({ data: payments.map(p => p.toJSON()) });
    } catch (err) {
      res.status(500).json({ err });
    }
  }
);

customerRouter.get('/payments/bulk/update',
  query('startDate').isDate().trim(),
  query('endDate').isDate().trim(),
  query('bulkUpdateDate').isDate().trim(),
  async (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      res.status(400).customerRender('admin-bulk-payments-show', {
        err: true,
        message: 'Invalid Dates',
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });
      return;
    }
    try {
      await models.payment.update({
        payment_date: req.query.bulkUpdateDate,
      }, {
        where: {
          [Op.and]: [{
            payment_date: {
              [Op.between]: [req.query.startDate, req.query.endDate],
            }
          }]
        }
      });
      res.status(200).customerRender('admin-customer-payments', {
        Bsuccess: true,
        message: 'SuccessFully updated'
      });
    } catch (err) {
      res.status(500).customerRender('admin-bulk-payments-show', {
        err: true,
        message: err,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });
    }
  });

customerRouter.route('/subscription').get((req, res, next) => {
  res.status(200).customerRender('admin-subscription');
});

customerRouter.route('/subscription/info').get(async (req, res, next) => {

});


export default customerRouter;
