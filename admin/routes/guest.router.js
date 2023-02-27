import express from 'express';
import { body, validationResult } from 'express-validator';
import { models } from '../../database/models.js';

const guestRouter = express.Router();

guestRouter.use((req, res, next) => {
  res.guestRender = (template, options) => {
    res.render(template, {
      loginname: req.session.name,
      post: req.session.post,
      title: 'Guest',
      ...options,
    });
  };
  next();
});

guestRouter.get('/add', (_req, res, next) => {
  res.guestRender('admin-guest');
});


guestRouter.post('/add',
  body('name').notEmpty().trim(),
  body('payamount').notEmpty().isNumeric().trim(),
  body('paydate').isDate().trim(),
  body('paymode').notEmpty().trim(),
  async (req, res, next) => {

    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      res.guestRender('admin-guest', {
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

      res.guestRender('admin-guest', { insertSuccess: true, message: 'guest added successfully' });

    } catch (err) {

      res.guestRender('admin-guest', { insertFail: true, message: err.message });
    }

  });

guestRouter.get('/table', (req, res, next) => {
  res.guestRender('admin-guest-table');
});

guestRouter.get('/list', async (req, res, next) => {
  try {
    const guests = await models.guest.findAll();
    res.status(200).json({ data: guests.map(guest => guest.toJSON()) });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

guestRouter.get('/delete', async (req, res, next) => {
  if (!req.query?.id) {
    res.status(400).guestRender('admin-guest-table', { err: true, message: 'Invalid Id given' });
    return;
  }

  try {
    await models.guest.destroy({ where: { id: req.query.id } });
    res.status(200).guestRender('admin-guest-table', { success: true, message: 'Delete Success' });
  } catch (err) {
    res.status(500).guestRender('admin-guest-table', { err: true, message: err.message });
  }

});

export default guestRouter;
