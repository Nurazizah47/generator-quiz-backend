import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Konfigurasi Multer untuk menyimpan file sementara di memori
const upload = multer({ storage: multer.memoryStorage() });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/generate-questions', upload.single('materialFile'), async (req, res) => {
  try {
    let materialText = req.body.material || '';

    // Jika user mengunggah file PDF
    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(req.file.buffer);
        materialText = pdfData.text;
      } else {
        return res.status(400).json({ error: 'Format file saat ini yang didukung secara otomatis adalah PDF.' });
      }
    }

    if (!materialText.trim()) {
      return res.status(400).json({ error: 'Materi kuliah atau file tidak boleh kosong!' });
    }

    // Meminta Gemini membuat soal berdasarkan teks materi
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Buatkan 5 soal pilihan ganda beserta kunci jawaban dan penjelasan singkat yang mendidik untuk setiap soal berdasarkan materi kuliah berikut:\n\n${materialText}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        }
      }
    });

    const questions = JSON.parse(response.text);
    res.json({ questions });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses file atau menghasilkan soal.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server backend berjalan di port ${PORT}`);
});