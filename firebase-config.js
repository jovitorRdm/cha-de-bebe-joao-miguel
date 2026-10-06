// ======================================================
// CONFIGURAÇÃO DO FIREBASE
// Pegue esses valores em: Firebase Console > Configurações
// do projeto (ícone de engrenagem) > Geral > Seus apps > app Web > SDK
// ======================================================

import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyD04pTvKY2wEA92jNkI42PorfH107r7fOQ",
  authDomain: "cha-de-bebe-joao-miguel.firebaseapp.com",
  projectId: "cha-de-bebe-joao-miguel",
  storageBucket: "cha-de-bebe-joao-miguel.firebasestorage.app",
  messagingSenderId: "352940269404",
  appId: "1:352940269404:web:cdecede49f5c72a066ab99"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);