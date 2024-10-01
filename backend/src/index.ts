import express, { Request, Response } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import dataJson from './data.json';  // Import your data.json
dotenv.config();

const app = express();
const port = 3000;

app.use(express.json());

// Define types for data.json structure
interface Choice {
    question?: string;
    choices?: { [key: string]: string | Choice };
    outcome?: string;
}

interface Category {
    id: string;
    name: string;
    question: string;
    choices: { [key: string]: Choice };
}

interface DataJson {
    categories: Category[]; 
}

// Cast the imported dataJson to the expected type
const data: DataJson = dataJson;

// OpenAI Configuration
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// OpenAI Functions: Defined to fetch data dynamically from JSON
const functions = [
  {
    name: "get_category_question",
    description: "Get the question for a category by its ID",
    parameters: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "ID of the category to fetch" },
      },
      required: ["categoryId"],
    },
  },
  {
    name: "get_choice_for_category",
    description: "Get the choice for a given category and question",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category name" },
        choice: { type: "string", description: "User's selected choice" },
      },
      required: ["category", "choice"],
    },
  },
];

// Route for handling OpenAI function calling
app.post('/api/openai-function', async (req: Request, res: Response) => {
  const { message } = req.body;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that helps users navigate categories and options in a decision tree.',
        },
        { role: 'user', content: message },
      ],
      functions: functions,
      function_call: "auto",  // Allow OpenAI to choose which function to call
    });

    const functionCall = response.data.choices[0].message.content;

    if (functionCall) {
      const { name, arguments: functionArgs } = functionCall;
      let result: any;

      // Handle "get_category_question" function call
      if (name === "get_category_question") {
        const { categoryId } = JSON.parse(functionArgs || '{}');
        const category = Object.values(data.categories).find(cat => cat.id === categoryId);

        if (category) {
          result = {
            question: category.question,
            choices: Object.keys(category.choices),
          };
        } else {
          result = { error: "Category not found" };
        }
      }

      // Handle "get_choice_for_category" function call
      else if (name === "get_choice_for_category") {
        const { category, choice } = JSON.parse(functionArgs || '{}');
        const categoryData = data.categories[category];

        if (categoryData && categoryData.choices[choice]) {
          const choiceData = categoryData.choices[choice];

          if (typeof choiceData === 'object' && 'question' in choiceData) {
            result = {
              question: choiceData.question,
              choices: Object.keys(choiceData.choices || {}),
            };
          } else {
            result = { outcome: choiceData };  // Final outcome (e.g., "100", "101")
          }
        } else {
          result = { error: "Invalid choice or category" };
        }
      }

      res.json({
        success: true,
        result,
      });
    } else {
      res.status(400).json({
        success: false,
        message: "No function call detected",
      });
    }
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to interact with OpenAI',
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
