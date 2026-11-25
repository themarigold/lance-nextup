export type Minutes = number;               // demo minutes since midnight; 10:15 am = 615
export type UserId = 'maya' | 'sam' | 'priya';
export type CleanState = 'dirty' | 'in_progress' | 'clean' | 'inspected';
export type Occupancy = 'vacant' | 'occupied';
export type Service = 'checkout' | 'stayover';
export type Category = 'ac' | 'plumbing' | 'light' | 'broken';
export const HOLDS: readonly Category[] = ['ac', 'plumbing'];

export interface Room {
  id: string;                               // '106'
  service: Service;
  occupancy: Occupancy;
  state: CleanState;
  assignee: UserId;
  roomType?: string;                        // 'Suite'
  vip?: boolean;
  arrival?: Minutes;                        // next guest; checkouts only
  dndUntil?: Minutes;
  lateCheckout?: Minutes;
}                                           // no hold field: hold is derived from tasks

export interface Task {
  id: string;                               // = the report action's id
  roomId: string;
  category: Category;
  reportedBy: UserId;
  createdAt: number;                        // epoch ms
  status: 'open' | 'fixed' | 'needs_part';  // needs_part is stretch
  noticeDismissed?: boolean;
}

export type Action =
  | { type: 'pick'; roomId: string; at: number }
  | { type: 'start'; id: string; roomId: string; at: number }
  | { type: 'finish'; id: string; roomId: string; at: number }
  | { type: 'report'; id: string; roomId: string; category: Category; at: number }
  | { type: 'undo'; actionId: string; at: number }  // must match before.actionId
  | { type: 'fix'; taskId: string; at: number }
  | { type: 'dismiss'; taskId: string; at: number }
  | { type: 'switchUser'; to: UserId; at: number }
  // stretch:
  | { type: 'needsPart'; taskId: string; at: number }
  | { type: 'stop'; roomId: string; at: number }
  | { type: 'open'; at: number };           // app opened as the current user

export interface State {
  user: UserId;
  picked?: string;                          // room id she tapped; cleared on start
  rooms: Room[];
  tasks: Task[];
  before?: { actionId: string; rooms: Room[]; tasks: Task[]; picked?: string };  // set by start/finish/report
  log: Action[];                            // accepted actions only, append-only
}
