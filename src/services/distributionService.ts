import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Distribution, Serving, OperationType, FirestoreErrorInfo } from '../types';

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_NAME = 'distributions';
const SERVING_COLLECTION = 'servings';

export const distributionService = {
  async createDistribution(data: Omit<Distribution, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const docRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...data,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    }
  },

  async getAllDistributions() {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];

    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Distribution[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    }
  },

  async updateDistribution(id: string, data: Partial<Distribution>) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
    }
  },

  async deleteDistribution(id: string) {
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
    }
  },

  // Serving methods
  async createServing(data: Omit<Serving, 'id' | 'userId' | 'createdAt'>) {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    try {
      const docRef = await addDoc(collection(db, SERVING_COLLECTION), {
        ...data,
        userId,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, SERVING_COLLECTION);
    }
  },

  async getAllServings() {
    const userId = auth.currentUser?.uid;
    if (!userId) return [];

    try {
      const q = query(
        collection(db, SERVING_COLLECTION),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Serving[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, SERVING_COLLECTION);
    }
  }
};
