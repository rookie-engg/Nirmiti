import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { models } from '../../database/models.js';
import { Op, Sequelize, where } from 'sequelize';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pdf from 'pdf-creator-node';
import { DateTime } from 'luxon';

const reportsRouter = express.Router();
const baseViewPath = 'admin/reports/';
const newCustomerReportTemplate = readFileSync(
  fileURLToPath(new URL('../report-templates/new-customer.html', import.meta.url)), 'utf-8');

reportsRouter.use((req, res, next) => {
  res.reportRender = (template, options) => {
    res.render(baseViewPath + template, {
      ...options,
      loginname: req.session.name,
      post: req.session.post,
      title: 'Reports'
    });
  };
  next();
});

reportsRouter.get('/', (_req, res, _next) => {
  res.status(200).reportRender('reports');
});

reportsRouter.get('/new-customers',
  query('startDate').notEmpty().isDate(),
  query('endDate').notEmpty().isDate(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(500).reportRender('reports');
      return;
    }
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    try {
      const customers = await models.customer.findAndCountAll({
        include: [{
          model: models.subscription,
          where: {
            renew_date: {
              [Op.between]: [startDate, endDate]
            }
          }
        }, {
          model: models.payment,
          order: [['createdAt', 'DESC']],
          limit: 1,
        }]
      });

      if (customers.count === 0) {
        res.status(200).send('<h1 style="text-align:center;">no customer found</h1>');
        return;
      }

      const document = {
        // path: fileURLToPath(new URL('../reports/report.pdf', import.meta.url)),
        html: newCustomerReportTemplate,
        type: 'stream',
        data: {
          startDate,
          endDate,
          customers: customers.rows.map((customer, index) => {
            const payment = customer.Payments[0];
            let paymode = '';
            if (payment.online) {
              paymode = `online(&#8377;${payment.online}), <br>`;
            }
            if (payment.cash) {
              paymode = paymode + `cash(&#8377;${payment.cash})`;
            }
            return {
              srno: index + 1,
              name: customer.first_name + ' ' + customer.last_name,
              duration: customer.Subscription.number_of_days,
              messPlan: customer.Subscription.sub_type == 'both' ? 'Lunch, Dinner' : 'lunch',
              paymentAdvance: payment.paid_amount,
              paymentPending: Number.parseFloat(payment.total_amount) - Number.parseFloat(payment.paid_amount),
              endDay: DateTime.fromISO(customer.Subscription.renew_date)
                .plus({ days: customer.Subscription.number_of_days })
                .toISODate(),
              paymode,
            }
          })
        },
      }

      const options = {
        format: "A4",
        orientation: "portrait",
        border: "10mm",
        footer: {
          height: "28mm",
          contents: {
            first: 'Page. 1',
            2: 'Page. 2', // Any page number is working. 1-based index
            default: '<span style="color: #444;">Page. {{page}}</span>', // fallback value
            last: 'Last Page'
          }
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition',
        'attachment; filename=new-customers-report(' + startDate + ' to ' + endDate + ').pdf');
      const stream = await pdf.create(document, options);
      stream.pipe(res);

    } catch (err) {
      res.sendStatus(500);
    }
  }
);

reportsRouter.get('/pending-payments', async (req, res, next) => {
  try {
    const customers = await models.customer.findAndCountAll({
      include: [{
        model: models.payment,
        attributes: ['total_amount', 'paid_amount', 'payment_date'],
        where: {
          status: 'pending',
        }
      }, {
        model: models.contact,
        attributes: ['phone', 'guardian_phone'],
      }],
    });
    const pendingPaymentsReportTemplate = readFileSync(
      fileURLToPath(new URL('../report-templates/pending-payments.html', import.meta.url)), 'utf-8');
    const document = {
      html: pendingPaymentsReportTemplate,
      type: 'stream',
      data: {
        customers: customers.rows.map((customer, index) => {
          return {
            srno: index + 1,
            name: customer.first_name + ' ' + customer.last_name,
            paymentRowsCount: customer.Payments.length,
            payments: customer.Payments.map(payment => {
              const total = Number.parseFloat(payment.total_amount);
              const paid = Number.parseFloat(payment.paid_amount);
              return {
                lastPayDate: DateTime.fromSQL(payment.payment_date).toFormat('MMMM dd, yyyy'),
                total,
                paid,
                pending: total - paid,
              }
            }),
            studentContact: customer.Contact.phone,
            guardianContact: customer.Contact.guardian_phone,
          }
        }),
      },
    };

    const options = {
      format: "A4",
      orientation: "portrait",
      border: "10mm",
      footer: {
        height: "28mm",
        contents: {
          first: 'Page. 1',
          2: 'Page. 2', // Any page number is working. 1-based index
          default: '<span style="color: #444;">Page. {{page}}</span>', // fallback value
          last: 'Last Page'
        }
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    const stream = await pdf.create(document, options);
    stream.pipe(res);

  } catch (err) {
    throw err;
    res.status(500).json({ err });
  }
});

export default reportsRouter;
