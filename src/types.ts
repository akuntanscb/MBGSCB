export interface Distribution {
  id?: string;
  date: string;
  arrivalTime: string;
  status?: string;
  recipient: string;
  studentOfficer?: string;
  menuDetails: string;
  photoUrl?: string;
  amount: number;
  userId: string;
  createdAt: any;
  updatedAt: any;
}

export interface Serving {
  id?: string;
  date: string;
  time: string;
  recipientName: string;
  amount: number;
  returnedAmount?: number;
  qualityControl?: 'Baik' | 'Kurang' | 'Tidak Layak';
  userId: string;
  createdAt: any;
  updatedAt?: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}
