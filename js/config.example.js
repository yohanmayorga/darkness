/**
 * Configuración de Google Firebase (Firestore + Auth) para Darkness
 * Nota: Las claves de Firebase Web son públicas de cliente; la seguridad
 * reside en las Reglas de Firestore (request.auth.uid == userId).
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAYmzDEmx_b9PYHKytyaqDWMnqF5MiDbCk',
  authDomain: 'darknessweb.firebaseapp.com',
  projectId: 'darknessweb',
  storageBucket: 'darknessweb.firebasestorage.app',
  messagingSenderId: '101652151120',
  appId: '1:101652151120:web:00603944d4dcb94f6ee37d'
};
