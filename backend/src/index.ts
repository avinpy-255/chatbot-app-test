import express from 'express';
import dotenv from 'dotenv';
import { processUserInput } from './chatbot';
import cors from 'cors';



dotenv.config();



const app = express();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 3000;

app.post('/chat', async (req, res) => {
  const { message, categoryId } = req.body;
  try {
    const response = await processUserInput(message, categoryId);
    res.json({ response });
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});