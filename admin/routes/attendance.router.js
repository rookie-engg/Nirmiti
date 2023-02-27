import express from 'express';
import { DateTime } from 'luxon';
import { models } from '../../database/models.js';

const attendanceRouter = express.Router();

attendanceRouter.use((req, res, next) => {
  res.attendanceRender = (template, options) => {
    res.render(template, {
      loginname: req.session.name,
      post: req.session.post,
      title: 'attendance',
      ...options,
    });
  }
  next();
});

attendanceRouter.get('', (req, res, next) => {
  res.attendanceRender('admin-attendance');
});

attendanceRouter.get('/mark', async (req, res, next) => {
  const ugnumber = req.query?.ugnumber;

  if (!ugnumber) {
    res.attendanceRender('admin-attendance', { err: true, message: 'Invalid UG Number' });
    return;
  }

  let currentDateTimeISO = req.query?.currentDateTimeISO;
  if (!currentDateTimeISO) {
    res.attendanceRender('admin-attendance', { err: true, message: 'Invalid Current Date TIme ISO' });
    return;
  }

  try {
    const customer = await models.customer.findOne({
      where: { ug_number: ugnumber.toUpperCase() },
      include: [models.subscription, models.activity]
    });

    if (!customer) {
      res.status(200).attendanceRender('admin-attendance', {
        err: true,
        message: `Reg Number ${ugnumber} Does't exists`
      });
      return;
    }
    const remaningDays = Number.parseFloat(customer.Subscription.remaining_days);
    if (remaningDays <= 0) {
      res.attendanceRender('admin-attendance', {
        modal: true,
        message: ugnumber.toString() + ' Subscription Expired Please Re-new',
      });
      return;
    }

    const status = customer.Subscription.status;
    if (status === 'inactive') {
      res.attendanceRender('admin-attendance', {
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
        res.attendanceRender('admin-attendance', {
          modal: true,
          message: `Attendance already marked!\n Daily Quota Over For ${ugnumber} SINGLE TIME`
        });
        return;
      }
      // if daily quota is exausted for both lunch & dinner customer
      if (subType === 'both' && lastCount == 2) {
        res.attendanceRender('admin-attendance', {
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

        res.attendanceRender('admin-attendance', {
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
          res.attendanceRender('admin-attendance', {
            modal: true,
            message: 'Already Attendance Mark for Lunch time for ' + ugnumber,
          });
          return;
        }

        if ((dinnerTime < dateTimeNow) && lastCount == 2) {
          res.attendanceRender('admin-attendance', {
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

        res.attendanceRender('admin-attendance', {
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

      res.attendanceRender('admin-attendance', {
        success: true,
        message: 'Attenedance Marked for ' + ugnumber,
      });
      return;
    }

  } catch (err) {
    console.error(err);
    res.status(500).attendanceRender('admin-attendance', { err: true, message: err.message });
  }
});

export default attendanceRouter;
