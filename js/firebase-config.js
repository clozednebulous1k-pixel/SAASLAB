// Chaves públicas do Firebase (podem ficar no front)
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCR-ealkay9uW-uFoM1ATw0cKqxeCGkroc",
  authDomain: "devserver-4d2c8.firebaseapp.com",
  projectId: "devserver-4d2c8",
  storageBucket: "devserver-4d2c8.firebasestorage.app",
  messagingSenderId: "627408482482",
  appId: "1:627408482482:web:4bba0444b9c71c174919ab",
};

// Fallback: e-mail admin (principal é users/{uid}.role === "admin" no Firestore)
window.ADMIN_EMAILS = [
  "ale@gmail.com",
];
