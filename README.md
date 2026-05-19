# AI-Powered CAT Preparation App

This project consists of an Expo React Native frontend and a Python FastAPI backend for CAT preparation. It uses SQLite via Prisma for local storage and Google Gemini + Pinecone for AI-powered RAG and question cloning.

## Architecture
- **Frontend**: Expo React Native, NativeWind (Tailwind), Expo Router.
- **Backend**: Python FastAPI, Prisma (SQLite), Google GenAI SDK, Pinecone.

## Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Expo Go app on your physical mobile device.

---

## 1. Backend Setup

1. Open a terminal and navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Generate the Prisma Client and apply the database schema:
   ```bash
   prisma db push
   prisma generate
   ```

5. Set your Environment Variables in `backend/.env`:
   ```env
   GEMINI_API_KEY=your_gemini_api_key
   PINECONE_API_KEY=your_pinecone_api_key
   PINECONE_INDEX_NAME=cat-prep-index
   ```

6. Run the FastAPI Server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
   > Note: Using `--host 0.0.0.0` allows your mobile app to access the backend over your local Wi-Fi network.

### Exploring the Database
You can visually explore your SQLite database using Prisma Studio:
```bash
prisma studio
```

---

## 2. Frontend Setup (Expo)

1. Open a new terminal and navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Find your local IP Address. (On Mac, you can check Wi-Fi settings or run `ipconfig getifaddr en0` in the terminal). Let's assume it's `192.168.1.100`.

4. (Optional) In the future, when connecting the API, you will set this IP in an `.env` file or directly in your Axios config:
   `EXPO_PUBLIC_API_URL=http://192.168.1.100:8000`

5. Start the Expo development server:
   ```bash
   npm start
   ```

6. Open the **Expo Go** app on your phone, ensure you are on the **same Wi-Fi network** as your computer, and scan the QR code displayed in the terminal.

## Current Progress
The UI components for the Dashboard, Mock Exam, Quick-Solve Arena, Flashcards, and Analytics Dashboard have been built using dummy data. You can navigate between them to test the layout and NativeWind styling on your device before we connect the backend endpoints.
