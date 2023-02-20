import { faker } from '@faker-js/faker/locale/en_IND'
import { models } from './database/models.js';
import dbInstance from './database/connect.js';

export async function insertDummyData(run = 200) {

  const customers = []

  for (let x = 0; x < run; x++) {
    const amount = faker.helpers.arrayElement(['2400', '1600']);
    const online = faker.datatype.number({ min: 0, max: Number.parseFloat(amount) });
    customers.push({
      ug_number: `UG` + `${x + 1}`.padStart(4, '0'),
      first_name: faker.name.firstName(),
      last_name: faker.name.lastName(),
      guardian_firstname: faker.name.firstName(),
      guardian_surname: faker.name.lastName(),
      joining_date: faker.date.recent(),
      Contact: {
        address: faker.address.streetAddress() + '\n' + faker.address.secondaryAddress() + '\n' + faker.address.streetAddress(),
        email: faker.internet.email(),
        phone: faker.phone.number('##########'),
        guardian_phone: faker.phone.number('##########'),
      },
      Subscription: {
        number_of_days: faker.helpers.arrayElement([30, 31]),
        renew_date: faker.date.soon(),
        remaining_days: faker.datatype.number({ min: 1, max: 30 }),
        sub_type: faker.helpers.arrayElement(['lunch', 'lunch-dinner']),
        status: 'active'
      },
      Payments: new Array(15).fill(null).map(e => {
        return {
          total_amount: 2400,
          paid_amount: amount,
          cash: online,
          status: amount ? 'pending' : 'complete',
          online: Number.parseFloat(amount) - online,
          payment_date: faker.date.recent(),
          txnid: faker.random.alphaNumeric(10),
        }
      }),
    });
  }

  await models.customer.bulkCreate(customers, {
    include: [models.contact, models.payment, models.subscription]
  })

  console.log('Successfully inserted');
}

