/* eslint-disable new-cap */
/* eslint-disable require-jsdoc */
import { DataTypes, Model } from 'sequelize';
import { dbInstance } from './connect.js';

export class Customer extends Model { };

Customer.init({
  ug_number: {
    type: DataTypes.STRING(10),
    primaryKey: true,
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
    },
  },
  first_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
      isAlpha: true,
    },
  },
  last_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
      isAlpha: true,
    },
  },
  guardian_firstname: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
      isAlpha: true,
    },
  },
  guardian_surname: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
      isAlpha: true,
    },
  },
  joining_date: {
    type: DataTypes.DATEONLY,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  sequelize: dbInstance,
  // tableName: 'customer',
  paranoid: true,
  timestamps: true,
});


export class Payment extends Model { };

Payment.init({
  bill_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      notNull: true,
      isInt: true,
    }
  },
  payment_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true,
      isDate: true,
    },
  },
  total_amount: {
    type: DataTypes.FLOAT(6, 2),
    allowNull: false,
    validate: {
      notNull: true,
      isFloat: true,
    },
  },
  paid_amount: {
    type: DataTypes.FLOAT(6, 2),
    allowNull: false,
    validate: {
      notNull: true,
      isFloat: true,
    },
  },
  status: {
    type: DataTypes.ENUM('complete', 'pending'),
    allowNull: false,
  },

  online: {
    type: DataTypes.FLOAT(6, 2),
    allowNull: true,
  },

  cash: {
    type: DataTypes.FLOAT(6, 2),
    allowNull: true,
  },

  txnid: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  sequelize: dbInstance,
  // tableName: 'payment',
  timestamps: true,
});

export class Contact extends Model { };

Contact.init({
  address: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
    },
  },
  guardian_phone: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
    },
  },
}, {
  sequelize: dbInstance,
  // tableName: 'contact',
  timestamps: true
});

export class Subscription extends Model { };

Subscription.init({
  number_of_days: {
    type: DataTypes.TINYINT,
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
      isInt: true,
    },
  },
  renew_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
    },
  },

  remaining_days: {
    type: DataTypes.FLOAT(4, 2),
    allowNull: false,
    validate: {
      notNull: true,
      notEmpty: true,
      isNumeric: true,
    },
  },
  sub_type: {
    type: DataTypes.ENUM('single', 'both'),
    allowNull: false,
    validate: {
      isIn: [['single', 'both']],
    },
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    validate: {
      isIn: [['active', 'inactive']],
    },
  },
}, {
  sequelize: dbInstance,
  // tableName: 'subscription', 
  timestamps: true,
});

export class Activity extends Model { };

Activity.init({
  last_active: DataTypes.STRING(40),
  last_count: DataTypes.TINYINT,
}, {
  sequelize: dbInstance,
  timestamps: true
});

export class Guest extends Model { };

Guest.init({
  name: DataTypes.STRING(80),
  paymode: {
    type: DataTypes.ENUM('online', 'cash'),
    allowNull: false,
  },
  payamount: {
    type: DataTypes.FLOAT(8, 2),
    allowNull: false,
  },
  paydate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  sequelize: dbInstance,
  //  tableName: 'guest',
  timestamps: true,
});

export class Complaint extends Model { };

Complaint.init({
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDateL: true,
    },
  },
  grievance: {
    type: DataTypes.TEXT,
  },
}, {
  sequelize: dbInstance,
  // tableName: 'complaint',
  timestamps: true,
});

export class Absent extends Model { };

Absent.init({
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    validate: {
      isDate: true,
    },
  },
  during: {
    type: DataTypes.ENUM('LUNCH', 'DINNER'),
    allowNull: false,
    validate: {
      isIn: [['LUNCH', 'DINNER']],
    },
  },
}, {
  sequelize: dbInstance,
  // tableName: 'absent'
  timestamps: true,
});

// export class Messtiming extends Model { };

// Messtiming.init({
//   title: DataTypes.STRING,
//   time: DataTypes.TIME,
// }, {
//   sequelize: dbInstance,
//   timestamps: false,
// });

Customer.hasOne(Contact);
Contact.belongsTo(Customer);

Customer.hasOne(Subscription);
Subscription.belongsTo(Customer);

Customer.hasMany(Payment);
Payment.belongsTo(Customer);

Customer.hasMany(Complaint);
Complaint.belongsTo(Customer);

Customer.hasMany(Absent);
Absent.belongsTo(Customer);

Customer.hasOne(Activity);
Activity.belongsTo(Customer);

export const models = {
  customer: Customer,
  subscription: Subscription,
  payment: Payment,
  guest: Guest,
  absent: Absent,
  complaint: Complaint,
  contact: Contact,
  activity: Activity,
  // messtiming: Messtiming
};
