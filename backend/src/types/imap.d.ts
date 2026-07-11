export type IMAPVerb =
  | 'CAPABILITY'
  | 'NOOP'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SELECT'
  | 'EXAMINE'
  | 'CREATE'
  | 'DELETE'
  | 'RENAME'
  | 'LIST'
  | 'LSUB'
  | 'STATUS'
  | 'FETCH'
  | 'STORE'
  | 'SEARCH'
  | 'APPEND'
  | 'EXPUNGE'
  | 'IDLE'
  | 'UID'
  | 'CLOSE';

export interface IMAPFetchItem {
  name: string;
  value: string;
}
