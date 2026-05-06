# AeroStruct: Aviation Regulatory Processor

AeroStruct is a high-fidelity semantic chunking and layout-aware processing tool designed for ICAO, EASA, and other aviation regulatory documents. It transforms dense, unstructured PDF text into structured, machine-readable JSON formats optimized for regulatory compliance and safety management systems.

## Features

- **Semantic Chunking**: Intelligent splitting of regulatory text based on section headers, provision numbers, and logical boundaries.
- **Aviation-Specific Extraction**: Precision extraction of regulatory references, effective dates, and technical requirements.
- **Dual Engine Support**:
  - **Cloud**: Native integration with Google Gemini for high-accuracy reasoning.
  - **Local**: Support for LM Studio, Ollama, and other OpenAI-compatible local APIs (Perfect for dark-site or sensitive data processing).
- **Interactive UI**: Real-time preview of extracted provisions with side-by-side comparison.
- **Compliance Ready**: Export processed data directly to standard JSON formats.

## Local LLM Integration

AeroStruct is designed to work seamlessly with local LLM servers like **LM Studio** or **Ollama**.

### Setup for LM Studio
1. Open LM Studio and start the Local Server.
2. Ensure **CORS** is enabled in the server settings (Access-Control-Allow-Origin: *).
3. In the AeroStruct settings, set your **Base API URL** (Default: `http://127.0.0.1:1234/api/v1`).
4. Select a loaded model from the dropdown.

### Browser Connectivity Note
If you are running AeroStruct via HTTPS (e.g., in a cloud environment) and trying to connect to a Localhost API (HTTP), you must allow **Insecure Content** in your browser settings for the connection to succeed:
1. Click the **Lock/Info icon** next to the URL in your browser.
2. Select **Site settings**.
3. Locate **Insecure content** and set it to **Allow**.

## Getting Started (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/aerostruct.git
   cd aerostruct
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Setup**:
   Create a `.env` file in the root directory and add your Google Gemini API key if you plan to use the cloud provider:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

### Build for Production

```bash
npm run build
```
Static files will be generated in the `dist/` directory.

## Tech Stack

- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS 4
- **Animations**: Motion
- **Icons**: Lucide React
- **AI Integration**: Google GenAI SDK & OpenAI-compatible local endpoints

## License

MIT
