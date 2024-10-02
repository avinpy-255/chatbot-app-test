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
let conversationState: 'category_selection' | 'service_selection' | 'collecting_details' | 'confirming_details' = 'category_selection';

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

    let systemPrompt = `You are a polite and helpful assistant guiding users through a service selection process. 
    The current question is: "${currentQuestion}". 
    The available choices are: ${JSON.stringify(currentChoices)}. User can also provide numbers as an input.  
    The current conversation state is: ${conversationState}.
    After getting all the information from save_service_id_and_zip, directly go to collecting details and ask user's for their information
    Guide the user based on the current state:
    - If in category_selection or service_selection, help them choose from the available options.
    - If in collecting_details, ask for the user's zip code, name, phone, email, and address in that order.
    - If in confirming_details, show all collected information and ask for confirmation. if user agree by saying yes or confirm save the information. Do not repeate the process
    Use the appropriate function to save each piece of information as it's provided.
    Current user data: ${JSON.stringify(userData)}
    Do not ask for information that has already been provided.`;

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
          if (functionArgs.field === 'address') {
            conversationState = 'confirming_details';
            return `Thank you for providing all the information. Please confirm if the following details are correct:
            
            Service ID: ${userData.serviceId}
            Zip Code: ${userData.zip}
            Name: ${userData.name}
            Phone: ${userData.phone}
            Email: ${userData.email}
            Address: ${userData.address}
            
            If everything is correct, please say "Confirm". If you need to make any changes, please let me know.`;
          }
          const nextField = getNextField(functionArgs.field);
          return `Thank you! Your ${functionArgs.field} has been recorded. Can you please provide your ${nextField}?`;
        case "save_to_database":
          if (conversationState === 'confirming_details' && message.toLowerCase() === 'confirm') {
            await saveToDatabase(functionArgs.userData);
            conversationState = 'category_selection';
            return "Thank you! All your information has been saved. Is there anything else I can help you with?";
          } else {
            return "User Data Saved!.";
          }
      }
    }

    // Update currentQuestion and currentChoices based on user's choice
    if (conversationState === 'service_selection' && currentChoices && currentChoices[message]) {
      const choice = currentChoices[message];
      if (typeof choice === 'object') {
        currentQuestion = choice.question;
        currentChoices = choice.choices;
      } else {
        // Final choice reached
        userData.serviceId = choice;
        currentQuestion = "What's your zip code?";
        currentChoices = null;
        conversationState = 'collecting_details';
      }
    }

    let responseContent = assistantMessage.content || "I apologize, but I couldn't generate a proper response. Could you please rephrase your question or provide more information?";

    conversationHistory.push({
      role: "assistant", 
      content: responseContent,
      name: undefined
    });

    return responseContent;

  } catch (error) {
    console.error("Error processing user input:", error);
    return "I apologize, but I encountered an error while processing your request. Could you please try again?";
  }
}

async function saveServiceIdAndZip(serviceId: string, zip: string): Promise<void> {
  userData.serviceId = serviceId;
  userData.zip = zip;
  console.log(`Saved service ID: ${serviceId} and zip: ${zip}`);
}

async function saveUserDetail(field: keyof UserData, value: string): Promise<void> {
  userData[field] = value;
  console.log(`Saved user detail - ${field}: ${value}`);
}

async function saveToDatabase(data: UserData): Promise<void> {
  console.log('Saving to database:', data);
}

function getNextField(currentField: string): string {
  const fields = ['zip', 'name', 'phone', 'email', 'address'];
  const currentIndex = fields.indexOf(currentField);
  return fields[currentIndex + 1] || '';
}