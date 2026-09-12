import { EventEmitter } from 'node:events'

export const committedEvents = new EventEmitter()
committedEvents.setMaxListeners(20)
