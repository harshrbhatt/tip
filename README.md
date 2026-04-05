# TIP — Telecom Intelligence Platform

![Build Status](https://img.shields.io/github/actions/workflow/status/YOUR-USERNAME/tip-dashboard/deploy.yml?branch=main)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

An AI-powered Telecom Intelligence Platform designed for data-driven insights, advanced analytics, and strategic recommendations. Provides an intuitive dashboard, dynamic Power BI style data editor, and LLM-integrated AI chat specifically tailored for the telecom sector.

## ✨ Features

- **📊 Advanced Analytics Dashboard**: Real-time visualization for Revenue, Churn, Subs, and ARPU.
- **🤖 LLM Built-In Chat**: Intelligent chat agent to query and process datasets directly (Supports Groq, Gemini, and OpenAI).
- **📝 Live Data Editor**: Built-in, Excel-like grid editor for dynamic data cleaning and manipulation.
- **🚀 AI Recommendations**: Auto-generated business insights based on uploaded data trends.
- **📈 Comprehensive History Context**: Persisted session context and prior analysis files.

## 🏗️ Architecture & Tech Stack

This project is built leveraging a modern, lightweight Vanilla Javascript approach with high-performance build tooling.

- **Frontend**: HTML5, Vanilla JS (ES Modules), Vanilla CSS variables (CSS Custom Properties)
- **Bundler**: Vite
- **Data Visualization**: Chart.js
- **Data Parsing**: SheetJS (xlsx)
- **Code Quality**: ESLint, Prettier, Husky

## 📦 Project Structure

```text
├── public/                 # Static assets and sample data
├── src/                    # Application source code
│   ├── assets/             # Images, fonts, icons
│   ├── components/         # Reusable UI components
│   ├── css/                # Stylesheets and tokens
│   ├── js/                 # Application logic and logic modules
│   ├── services/           # External API handlers (LLMs)
│   └── utils/              # Helper functions and formatter utilities
├── .github/workflows/      # CI/CD Pipelines
└── index.html              # Main application entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- Git

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR-USERNAME/tip-dashboard.git
   cd tip-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3030`.

## 🛠️ Scripts

- `npm run dev` - Starts the Vite development server.
- `npm run build` - Builds the app for production to the `/dist` folder.
- `npm run preview` - Previews the production build locally.
- `npm run lint` - Runs ESLint to find code issues.
- `npm run format` - Automatically formats all JS, CSS, and HTML using Prettier.

## 🤝 Contributing

Contributions, issues and feature requests are welcome!
Feel free to check [issues page](https://github.com/YOUR-USERNAME/tip-dashboard/issues). Please refer to the [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 📝 License

This project is [MIT](LICENSE) licensed.
