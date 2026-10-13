# DearSkin 🌸

A skincare companion web app that makes routines easier to stick to. Track the products you own, run your morning and evening routine step by step, and see how your skin changes over time with progress photos.

It installs on your phone like a native app (PWA) and syncs across devices with a Firebase account.

<img width="414" height="777" alt="image" src="https://github.com/user-attachments/assets/4e5d2258-da44-4322-b041-f6e62d9edc42" /> <img width="381" height="781" alt="image" src="https://github.com/user-attachments/assets/bd1c6212-293f-4260-b0c3-6aa173e8d50d" />


## Features

- **Onboarding quiz.** Asks about skin type, concerns, lifestyle and goals to set up your profile.
- **Routine builder and timer.** Separate morning and evening routines, with a guided step-by-step mode and wait times between steps.
- **Digital shelf.** Keep track of the products you own and which routine each one belongs to.
- **Ingredient checker.** A built-in ingredient database flags actives that shouldn't be used together, such as retinol with vitamin C or AHAs.
- **Skin diary.** Upload progress photos. Face detection (face-api.js) finds your face and marks facial landmarks on each photo.
- **Accounts and sync.** Email/password or Google sign-in with Firebase, with your data saved to Firestore.
- **Works offline and installs as an app.** Service worker, web manifest and home-screen shortcuts for "Start Routine" and "Log Skin".
- **Accessibility settings.** Theme, font size, reduced motion and keyboard navigation.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript (one manager class per feature) |
| Backend | Firebase Authentication, Cloud Firestore, Firebase Storage |
| Offline | Service worker, IndexedDB, PWA manifest |
| Computer vision | face-api.js (Tiny Face Detector) |

## Project structure

```
├── index.html            # main app: home, routine, products, progress, profile tabs
├── onboarding.html       # first-run skin profile quiz
├── auth.html             # sign in / sign up
├── app.js                # app shell and tab navigation
├── js/
│   ├── routine-manager.js
│   ├── product-manager.js
│   ├── progress-manager.js
│   ├── accessibility-manager.js
│   ├── firebase-*.js     # auth, Firestore and Storage helpers
│   └── storage-manager.js
├── data/ingredient-database.json
├── manifest.json
└── service-worker.js
```

## Running it locally

1. Clone the repo.
2. Create a Firebase project, enable Authentication (Email/Password and Google), Firestore and Storage.
3. Put your Firebase web config in `js/firebase-config.js`.
4. Serve the folder with any static server, for example:
   ```bash
   npx serve .
   ```
   A server is needed (not just opening the file) so the service worker and Firebase work.

## Author

**Muhammad Naufal Mohd Nizam**, Intelligent System Engineering student at UiTM
[Portfolio](https://fvlnzm.my) · [LinkedIn](https://www.linkedin.com/in/muhammad-naufal-bin-mohd-nizam-0603b2279)
