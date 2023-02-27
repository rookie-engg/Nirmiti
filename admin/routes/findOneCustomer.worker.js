import { workerData, parentPort } from 'node:worker_threads';
import { models } from '../../database/models.js';

process.on('exit', () => process.exit());

if (workerData?.hasOwnProperty('include')) {

  // replace model strings with model instances
  workerData.include = workerData.include.map(m => {
    m.model = models[m.model];
    return m;
  });
};

try {
  const result = await models.customer.findOne(workerData);
  parentPort.postMessage(result.toJSON());
} catch (err) {
  parentPort.emit('messageerror', err);
} finally {
  process.exit();
}
