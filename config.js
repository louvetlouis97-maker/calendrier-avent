// =====================================================================
//  CALENDRIER DE L'AVENT — Équipe cycliste Groupama-FDJ UNITED
//  Fichier de réglages : c'est le SEUL fichier à modifier.
// =====================================================================

// 1) Configuration Firebase
//    À copier depuis : Console Firebase > ⚙ Paramètres du projet > Général
//    > « Vos applications » > Configuration du SDK (option « Config »).
export const firebaseConfig = {
  apiKey: "AIzaSyDhD32ce75DuoUKA15GupZ3DraSlmP5-9E",
  authDomain: "calendrier-avent-gfdj.firebaseapp.com",
  projectId: "calendrier-avent-gfdj",
  storageBucket: "calendrier-avent-gfdj.firebasestorage.app",
  messagingSenderId: "168026610536",
  appId: "1:168026610536:web:3c9d4acca91d45e6e294dd"
};

// 2) Date d'ouverture de la case 1 (heure de Paris, à minuit).
//    Pour tester avant décembre, mets la date du jour ici ET dans les règles Firestore.
export const START_DATE = "2026-12-01";

// 3) Partenaire affiché sur chaque case (dans l'ordre, de la case 1 à la case 24).
//    null = logo de l'équipe. Le nom doit correspondre à un logo de la liste LOGOS ci-dessous.
//    Le LOT n'est pas ici : il est stocké dans Firestore et n'est visible que le jour J.
export const PARTNERS = [
  "Bioracer", "Districlos", "Compressport", "L'Arbre Vert", "Continental", "Winforce",
  "Méo", "Panzani", "Elite", "GOWOD", "FDJ UNITED", "Technisom",
  "SGE", "De Buyer", "Nature&Cie", "JOLT", null, "iGPSPORT",
  "Prologo", "Bioracer", null, "Julbo", null, "Elite"
];

// 4) Logos (fichiers dans le dossier img/logos). Un partenaire sans logo s'affiche en texte.
export const LOGOS = {
  "Bioracer": "img/logos/bioracer.png",
  "Districlos": "img/logos/districlos.png",
  "Compressport": "img/logos/compressport.png",
  "L'Arbre Vert": "img/logos/l-arbre-vert.png",
  "Continental": "img/logos/continental.png",
  "Winforce": "img/logos/winforce.png",
  "Méo": "img/logos/meo.png",
  "Panzani": "img/logos/panzani.png",
  "Elite": "img/logos/elite.png",
  "GOWOD": "img/logos/gowod.png",
  "FDJ UNITED": "img/logos/fdj-united.png",
  "Technisom": "img/logos/technisom.png",
  "SGE": "img/logos/team.png",
  "De Buyer": "img/logos/de-buyer.png",
  "Nature&Cie": "img/logos/nature-cie.png",
  "JOLT": "img/logos/jolt.png",
  "iGPSPORT": "img/logos/igpsport.png",
  "Prologo": "img/logos/prologo.png",
  "TEAM": "img/logos/team.png"
};

// 5) Lien « Voir le gagnant » : mets ici l'adresse du compte Instagram de l'équipe.
export const RESULTS_URL = "https://www.instagram.com/";

// 6) Adresse de contact affichée dans la politique de confidentialité et le règlement.
export const CONTACT_EMAIL = "A_REMPLACER@equipecycliste-groupama-fdj.fr";
