# Sisu

<p align="center">
  <img src="public/sisu-logo.png" alt="Sisu Logo" width="120" />
</p>

**Sisu** is a mellow, cosy reading app designed for a calm and focused reading experience. Built with a modern tech stack, it provides a seamless, offline-first environment for your EPUB and PDF collection.

[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://reactjs.org/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange.svg?style=for-the-badge)](https://web.dev/progressive-web-apps/)

---

##  Features

-  **Multi-format Support**: Seamlessly read both **EPUB** and **PDF** files with a unified interface.
-  **Offline First**: All your books, progress, and settings are stored locally using **IndexedDB**, ensuring you can read anytime, anywhere.
-  **Reading Progress**: Track your reading stats, daily goals, and streaks to stay motivated.
-  **Cosy Aesthetic**: Features a minimalist design with smooth animations powered by **Framer Motion**.
-  **Dynamic Theming**: Support for Light, Dark, and System modes to suit your reading environment.
-  **PWA Ready**: Install Sisu on your mobile device or desktop for a native-like experience.
-  **Discover**: Browse and search for new reading material directly within the app.

##  Tech Stack

- **Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Radix UI](https://www.radix-ui.com/) & [Lucide React](https://lucide.dev/)
- **Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via `idb` & `idb-keyval`)
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Routing**: [React Router 7](https://reactrouter.com/)
- **Core Readers**: [Epub.js](https://github.com/futurepress/epub.js) & [React-PDF](https://github.com/wojtekmaj/react-pdf)

##  Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sisu.git
   cd sisu
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

##  Project Structure

```text
sisu/
├── public/          # Static assets and PWA icons
├── src/
│   ├── assets/      # Image and SVG assets
│   ├── components/  # Reusable UI components (Radix, UI primitives)
│   ├── hooks/       # Custom React hooks (useFileReader, useMobile, etc.)
│   ├── lib/         # Utility functions and Database logic (db.js, meta-utils.js)
│   ├── pages/       # Main application views (Library, Reader, Discover, etc.)
│   ├── App.jsx      # Main application entry and routing
│   └── main.jsx     # Vite entry point
└── ...config files  # Vite, Tailwind, ESLint, PWA configs
```

##  Contributing

Contributions are welcome! Whether it's a bug fix, a new feature, or an improvement to the documentation, feel free to open an issue or submit a pull request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

##  License

This project is open-source and available under the **MIT License**.

##  Acknowledgements

- [Epub.js](https://github.com/futurepress/epub.js) for the amazing EPUB engine.
- [React-PDF](https://github.com/wojtekmaj/react-pdf) for the PDF integration.
- [Shadcn UI](https://ui.shadcn.com/) for the inspiration behind the component library.

---

<p align="center">Made with ❤️ for readers everywhere.</p>
