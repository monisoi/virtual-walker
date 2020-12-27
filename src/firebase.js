import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import * as firebaseAdmin from "firebase-admin";
import serviceAccount from "../config/serviceAccountKey";
import firebaseConfig from "../config/firebaseConfig";

firebase.initializeApp(firebaseConfig);

export const auth = firebase.auth();
export const provider = new firebase.auth.GoogleAuthProvider();
export const db = firebase.firestore();
export const admin = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
});
