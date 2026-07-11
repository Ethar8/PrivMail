import { MailQueue } from './queue';
import { deliverMessage } from './delivery';

export const outboundQueue = new MailQueue(deliverMessage);

export { MailQueue } from './queue';
export { deliverMessage } from './delivery';
export type { QueuedMessage, DeliveryResult } from './queue';
