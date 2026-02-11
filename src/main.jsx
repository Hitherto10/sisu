import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { register as registerServiceWorker } from './serviceWorkerRegistration';

createRoot(document.getElementById("root")).render(<App />);

// Register service worker for PWA functionality
registerServiceWorker();