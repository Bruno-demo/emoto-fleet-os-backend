import { NotificationDispatchInput } from './incidents.types';

export const NOTIFICATION_PROVIDER = Symbol('NOTIFICATION_PROVIDER');

export interface NotificationProvider {
  send(input: NotificationDispatchInput): Promise<void>;
}
