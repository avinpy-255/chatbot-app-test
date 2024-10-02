import fs from 'fs/promises';
import OpenAI from 'openai';
import dotenv from 'dotenv';

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
let conversationHistory: Array<{
  name: any; role: string; content: string 
}> = [];
let conversationState: 'category_selection' | 'service_selection' | 'collecting_details' = 'category_selection';

export async function processUserInput(message: string, categoryId?: string): Promise<string> {
  try {
    if (categoryId) {
      const idMapping = JSON.parse(await fs.readFile('id.json', 'utf-8'));
      const categoryName = idMapping[categoryId];
      const data = JSON.parse(await fs.readFile('data.json', 'utf-8'));
      currentCategory = data.categories[categoryName];
      if (currentCategory) {
        currentQuestion = currentCategory.question;
        currentChoices = currentCategory.choices;
        conversationState = 'service_selection';
      } else {
        throw new Error(`Category ${categoryName} not found in the data.`);
      }
    }

    let systemPrompt = `You are a polite and helpful assistant guiding users through a service selection process. Your tone should always be friendly and courteous.

      The current conversation state is: ${conversationState}.

      Guide the user based on the current state:
      1. If in category_selection or service_selection:
         - The current question is: "${currentQuestion}"
         - Present the available choices in a numbered list format:
           ${Object.entries(currentChoices || {}).map(([key, value], index) => 
             `${index + 1}. ${key}`
           ).join('\n         ')}
         - Help the user choose from these options.
         - Users can respond with either the option name or its corresponding number.

      2. If all service-related questions are answered:
         - Ask for the user's zip code.

      3. After collecting the zip code, proceed to collect user details in this order: name, phone, email, and address.

      Use the appropriate function to save each piece of information as it's provided.

      Current user data: ${JSON.stringify({ ...userData, serviceId: '[HIDDEN]' })}

      Important guidelines:
      - Complete all service-related questions before asking for personal information.
      - Do not ask for information that has already been provided.
      - Do not mention or show the service ID to the user at any point.
      - Retrieve and use the service ID internally, but keep it hidden from the user's view.
      - Maintain a polite and helpful tone throughout the conversation.`;

    conversationHistory.push({
      role: "user", content: message,
      name: undefined
    });

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
        description: "Save a user name, email, phone number and address sequentially",
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
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map(history => ({ role: history.role as "user" | "assistant", content: history.content, name: history.name }))
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
          conversationState = 'collecting_details';
          return "Great! Your zip code has been recorded. Can you please provide your name?";
        case "save_user_detail":
          await saveUserDetail(functionArgs.field as keyof UserData, functionArgs.value);
          const nextField = getnextField(functionArgs.field);
          if (nextField) {
            return `Thank you! Your ${functionArgs.field} has been recorded. Can you please provide your ${nextField}?`;
          } else {
            await saveToDatabase(userData);
            conversationState = 'category_selection';
            return "Thank you! All your information has been saved. Is there anything else I can help you with?";
          }
        case "save_to_database":
          await saveToDatabase(functionArgs.userData);
          conversationState = 'category_selection';
          return "Thank you! All your information has been saved. Is there anything else I can help you with?";
      }
    }

    if (!assistantMessage.content) {
      throw new Error("No content in assistant's message");
    }

    conversationHistory.push({
      role: "assistant", 
      content: assistantMessage.content,
      name: undefined
    });

    return assistantMessage.content;

  } catch (error) {
    console.error("Error processing user input:", error);
    
    // Fallback mechanism: Create another completion without function calls
    try {
      const fallbackCompletion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant. The previous attempt to respond failed. Please provide a general, friendly response to the user's last message." },
          ...conversationHistory.map(history => ({ role: history.role as "user" | "assistant", content: history.content, name: history.name }))
        ],
      });

      const fallbackMessage = fallbackCompletion.choices[0].message.content || "I apologize, but I'm having trouble processing your request at the moment. Could you please try again or rephrase your question?";

      conversationHistory.push({
        role: "assistant", 
        content: fallbackMessage,
        name: undefined
      });

      return fallbackMessage;

    } catch (fallbackError) {
      console.error("Fallback response generation failed:", fallbackError);
      return "I'm very sorry, but I'm experiencing technical difficulties at the moment. Please try again later.";
    }
  }
}

// Function to determine the next user detail to ask for
function getnextField(currentField: string): string | null {
  const fieldsOrder = ['name', 'phone', 'email', 'address'];
  const currentIndex = fieldsOrder.indexOf(currentField);

  if (currentIndex === -1 || currentIndex === fieldsOrder.length - 1) {
    return null; // No more fields to ask
  }

  return fieldsOrder[currentIndex + 1];
}

// Implement the saveServiceIdAndZip function
async function saveServiceIdAndZip(serviceId: string, zip: string) {
  userData.serviceId = serviceId;
  userData.zip = zip;
}

// Implement the saveUserDetail function
async function saveUserDetail(field: keyof UserData, value: string) {
  userData[field] = value;
}

// Implement the saveToDatabase function (you can modify this to actually save to a database or file)
async function saveToDatabase(userData: UserData) {
  await fs.writeFile('userData.json', JSON.stringify(userData, null, 2));
  console.log("User data saved:", userData);
}
