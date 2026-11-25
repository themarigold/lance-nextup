import type { State } from './types'

/** The demo clock: always 10:15 am. */
export const NOW = 615

export const seed: State = {
  user: 'maya',
  rooms: [
    { id: '101', service: 'checkout', occupancy: 'vacant', state: 'inspected', assignee: 'maya' },
    { id: '102', service: 'checkout', occupancy: 'vacant', state: 'clean', assignee: 'maya' },
    { id: '103', service: 'checkout', occupancy: 'vacant', state: 'dirty', assignee: 'maya', roomType: 'King', arrival: 840 },
    { id: '104', service: 'stayover', occupancy: 'occupied', state: 'dirty', assignee: 'maya' },
    { id: '105', service: 'stayover', occupancy: 'occupied', state: 'dirty', assignee: 'maya', dndUntil: 645 },
    { id: '106', service: 'checkout', occupancy: 'vacant', state: 'dirty', assignee: 'maya', roomType: 'Suite', vip: true, arrival: 690 },
    { id: '107', service: 'checkout', occupancy: 'occupied', state: 'dirty', assignee: 'maya', lateCheckout: 720 },
    { id: '108', service: 'checkout', occupancy: 'vacant', state: 'dirty', assignee: 'maya' },
    { id: '204', service: 'stayover', occupancy: 'occupied', state: 'dirty', assignee: 'priya' },
  ],
  // createdAt 0: older than any report filed in the app (those use Date.now()).
  tasks: [{ id: 't-204', roomId: '204', category: 'light', reportedBy: 'priya', createdAt: 0, status: 'open' }],
  log: [],
}
