import axios from 'axios';

function getApiUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // Production: always use deployed Render backend
  return 'https://cat-backend-bdyo.onrender.com';
}

const API_URL = getApiUrl();

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const aiService = {
  generateClone: async (topic: string, difficulty: string = "Medium") => {
    const response = await apiClient.post('/generate-clone/', { topic, difficulty });
    return response.data.clone;
  },
  generateClones: async (topic: string, difficulty: string = "Medium", count: number = 10) => {
    const response = await apiClient.post('/generate-clones/', { topic, difficulty, count });
    return response.data as { clones: Array<{ question_text: string; options: string[]; answer: string; concept_hint: string }>; source: 'gemini' | 'puter' | 'local' };
  }
};

export const flashcardService = {
  getFlashcards: async () => {
    const response = await apiClient.get('/flashcards/');
    return response.data;
  },
  generateFlashcards: async (topic: string, count: number = 5) => {
    const response = await apiClient.post('/generate-flashcards/', { topic, count });
    return response.data;
  },
  reviewFlashcard: async (flashcardId: string, difficulty: "Hard" | "Good" | "Easy") => {
    const response = await apiClient.post('/flashcards/review', { flashcardId, difficulty });
    return response.data;
  }
};

export const analyticsService = {
  getAnalytics: async () => {
    const response = await apiClient.get('/analytics/');
    return response.data;
  }
};

export const mockExamService = {
  submitExam: async (answers: Record<string, string>, timeTaken: string) => {
    const response = await apiClient.post('/mock-exam/submit', { answers, timeTaken });
    return response.data;
  }
};
