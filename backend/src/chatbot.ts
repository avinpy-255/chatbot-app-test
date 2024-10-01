const fs = require('fs').promises;
import OpenAI from 'openai';
import dotenv from 'dotenv'

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Category {
  question: string;
  choices: Record<string, string | { question: string; choices: Record<string, string> }>;
}

interface UserData {
  serviceId: string;
  zip: string;
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
}

let userData: UserData = { serviceId: '', zip: '' };
let currentCategory: Category | null = null;
let currentChoices: Record<string, string | { question: string; choices: Record<string, string> }> | null = null;
let currentQuestion: string | null = null;

export async function processUserInput(message: string, categoryId?: string): Promise<string> {
  if (categoryId) {
    const idMapping = JSON.parse(await fs.readFile('id.json', 'utf-8'));
    const categoryName = idMapping[categoryId];
    const data = JSON.parse(await fs.readFile('data.json', 'utf-8'));
    currentCategory = data.categories[categoryName];
    if (currentCategory) {
      currentQuestion = currentCategory.question;
      currentChoices = currentCategory.choices;
    } else {
      throw new Error(`Category ${categoryName} not found in the data.`);
    }
  }

  let systemPrompt = `You are a polite and helpful assistant guiding users through a service selection process. 
  The current question is: "${currentQuestion}". 
  The available choices are: ${JSON.stringify(currentChoices)}. 
  Guide the user to select from these choices. 
  If the user has made a final choice, use the save_service_id_and_zip function to save the service ID and ask for their zip code. 
  After saving the service ID and zip, ask for the user's name, phone, email, and address one by one. 
  Use the save_user_detail function to save each piece of information as soon as it's provided. 
  Once all details are collected, use the save_to_database function to save everything. 
  Do not ask for information that has already been provided.`;

  const functions = [
    {
      name: "save_service_id_and_zip",
      description: "Save the selected service ID and zip code",
      parameters: {
        type: "object",
        properties: {
          serviceId: { type: "string" },
          zip: { type: "string" }
        },
        required: ["serviceId", "zip"]
      }
    },
    {
      name: "save_user_detail",
      description: "Save a user detail",
      parameters: {
        type: "object",
        properties: {
          field: { type: "string", enum: ["name", "phone", "email", "address"] },
          value: { type: "string" }
        },
        required: ["field", "value"]
      }
    },
    {
      name: "save_to_database",
      description: "Save all user data to the database",
      parameters: {
        type: "object",
        properties: {
          userData: {
            type: "object",
            properties: {
              serviceId: { type: "string" },
              zip: { type: "string" },
              name: { type: "string" },
              phone: { type: "string" },
              email: { type: "string" },
              address: { type: "string" }
            },
            required: ["serviceId", "zip"]
          }
        },
        required: ["userData"]
      }
    }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0613",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ],
    functions: functions,
    function_call: "auto",
  });

  const assistantMessage = completion.choices[0].message;

  if (assistantMessage.function_call) {
    const functionName = assistantMessage.function_call.name;
    const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

    switch (functionName) {
      case "save_service_id_and_zip":
        await saveServiceIdAndZip(functionArgs.serviceId, functionArgs.zip);
        break;
      case "save_user_detail":
        await saveUserDetail(functionArgs.field as keyof UserData, functionArgs.value);
        break;
      case "save_to_database":
        await saveToDatabase(functionArgs.userData);
        break;
    }
  }

  // Update currentQuestion and currentChoices based on user's choice
  if (currentChoices && currentChoices[message]) {
    const choice = currentChoices[message];
    if (typeof choice === 'object') {
      currentQuestion = choice.question;
      currentChoices = choice.choices;
    } else {
      // Final choice reached
      currentQuestion = "What's your zip code?";
      currentChoices = null;
    }
  }

  return assistantMessage.content || "I'm processing your request. How can I help you further?";
}

async function saveServiceIdAndZip(serviceId: string, zip: string): Promise<string> {
  userData.serviceId = serviceId;
  userData.zip = zip;
  console.log(`Saved service ID: ${serviceId} and zip: ${zip}`);
  return JSON.stringify({ serviceId, zip });
}

async function saveUserDetail(field: keyof UserData, value: string): Promise<string> {
  userData[field] = value;
  console.log(`Saved user detail - ${field}: ${value}`);
  return JSON.stringify({ [field]: value });
}

async function saveToDatabase(data: UserData): Promise<string> {
  // Implement the database saving logic here
  console.log('Saving to database:', data);
  return JSON.stringify(data);
}