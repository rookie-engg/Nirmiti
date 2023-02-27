import express from 'express';
import { body, validationResult } from 'express-validator';
import { models } from '../../database/models.js';
import { DateTime } from 'luxon';

const subscriptionRouter = express.Router();
const baseView = 'admin/subscription';

// add custome render function name subRender
subscriptionRouter.use((req, res, next) => {
  res['subRender'] = (template, options) => {
    res.render(baseView + '/' + template, {
      loginname: req.session.name,
      post: req.session.post,
      title: 'Subscription',
      ...options
    });
  };
  next();
});

subscriptionRouter.route('/show')
  .get(async (req, res, next) => {
    res.status(200).subRender('show-form');
  }).post(async (req, res, next) => {
    // check if request is valid
    const ugnumber = req.body?.ugnumber;
    if (!ugnumber) {
      res.subRender('show-form', { err: true, message: 'Invalid Ug number' });
      return;
    }
    try {
      const customer = await models.customer.findOne({
        where: {
          ug_number: ugnumber
        },
        include: [models.subscription],
      });
      if (!customer) {
        res.status(404).subRender('show-form', {
          err: true,
          message: `Req No "${ugnumber}" not found!`
        })
        return;
      }
      console.log(customer);
      res.status(200).subRender('show', { data: customer });
    } catch (err) {
      res.subRender('show-form', { err: true, message: err.message });
    }
  });

subscriptionRouter.route('/renew').get((req, res, next) => {
  res.status(200).subRender('renew-form');
});

subscriptionRouter.get('/renew/show', async (req, res, next) => {
  const ugnumber = req.query.ugnumber;
  console.log(ugnumber);
  if (!ugnumber) {
    res.status(400).subRender('renew-form', {
      err: true,
      message: 'Invalid Ug Number'
    })
    return;
  }

  try {
    const customer = await models.customer.findOne({
      where: {
        ug_number: ugnumber,
      },
      include: [models.subscription]
    });

    if (!customer) {
      res.status(404).subRender('renew-form', {
        err: true,
        message: `Customer with ${ugnumber} not found`,
      });
      return;
    }
    customer.Subscription.statusActive = customer.Subscription.status == 'active' ? true : false;
    customer.Subscription.statusInActive = customer.Subscription.status == 'inactive' ? true : false;
    customer.Subscription.typeSingle = customer.Subscription.sub_type == 'single' ? true : false;
    customer.Subscription.typeBoth = customer.Subscription.sub_type == 'both' ? true : false;
    res.status(200).subRender('renew', {
      data: customer
    });
  } catch (err) {
    res.status(500).subRender('renew-form', {
      err: true,
      message: err.message
    });
  }
});

subscriptionRouter.route('/renew/update').post(
  body('ugnumber').notEmpty().isAlphanumeric(),
  body('messPlan').notEmpty().isNumeric(),
  body('messType').notEmpty().isIn(['both', 'single']),
  body('status').isIn(['active', 'inactive']),
  body('totalAmount').notEmpty().isNumeric(),
  body('paidAmount').notEmpty().isNumeric(),
  body('remaningAmount').notEmpty().isNumeric(),
  body('cash').optional().isNumeric(),
  body('online').optional().isNumeric(),
  body('payDate').notEmpty().isDate(),
  body('date').notEmpty().isDate(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).subRender('renew-form', {
        err: true,
        message: errors.array().map(e => `${e.param}: ${e.msg}(${e.value})`).join('<br>'),
      });
      return;
    }

    const customer = await models.customer.findOne({
      where: {
        ug_number: req.body.ugnumber,
      },
      include: [models.payment, models.subscription]
    });

    customer.Subscription.set({
      number_of_days: req.body.messPlan,
      renew_date: req.body.date,
      remaining_days: Number.parseFloat(customer.Subscription.remaining_days) + Number.parseFloat(req.body.messPlan),
      sub_type: req.body.messType,
      status: req.body.status,
    });

    const payment = customer.createPayment({
      payment_date: req.body.payDate,
      total_amount: req.body.totalAmount,
      paid_amount: req.body.paidAmount,
      status: req.body.totalAmount == req.body.paidAmount ? 'complete' : 'pending',
      online: req.body.online,
      cash: req.body.cash,
      txnid: req.body.txnid,
    });

    await Promise.all([customer.Subscription.save(), payment]);

    res.status(200).subRender('renew-form', {
      success: true,
      message: 'Subscription renewed expected end date: ' +
        DateTime.fromISO(req.body.date).plus({ days: customer.Subscription.remaining_days }).toFormat('MMMM dd, yyyy'),
    });
  });

subscriptionRouter.route('/status').get((req, res, next) => {
  res.status(200).subRender('status-form');
})

subscriptionRouter.get('/status/show', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;
  if (!ugnumber) {
    res.status(400).subRender('status-form', {
      err: true,
      message: 'Invalid Ug Number'
    })
    return;
  }

  try {
    const customer = await models.customer.findOne({
      where: {
        ug_number: ugnumber,
      },
      include: [{ model: models.subscription, attributes: ['status'] }]
    });

    if (!customer) {
      res.status(404).subRender('status-form', {
        err: true,
        message: 'Customer with id ' + ugnumber + 'not found'
      });
      return;
    }
    res.status(200).subRender('status', {
      data: customer,
      statusActive: customer.Subscription.status == 'active' ? true : false,
      statusInActive: customer.Subscription.status == 'inactive' ? true : false,
    });

  } catch (err) {
    res.status(500).subRender('status-form', {
      err: true,
      message: err.message
    });
  }
});

subscriptionRouter.post('/status/update',
  body('status').notEmpty().isIn(['active', 'inactive']),
  async (req, res, next) => {
    const ugnumber = req.query?.ugnumber;
    if (!ugnumber) {
      res.status(400).subRender('status-form', {
        err: true,
        message: 'Invalid UG number'
      });
      return;
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).subRender('status-form', {
        err: true,
        message: errors.array().map(e => e.param + ':' + e.value + '(' + e.msg + ')<br>')
      })
      return;
    }
    try {
      const customer = await models.customer.findOne({
        where: {
          ug_number: ugnumber,
        },
        include: [models.subscription]
      });

      customer.Subscription.status = req.body.status;
      await customer.Subscription.save();

      res.status(200).subRender('status-form', {
        success: true,
        message: 'Status Updated'
      });
    } catch (err) {
      res.status(500).subRender('status-form', {
        err: true,
        message: err
      })
    }
  });

export default subscriptionRouter;
