import express, {Request, Response, RequestHandler} from 'express'
import dotenv from 'dotenv'
import dataJson from '../src/data.json'
import idJson from './id.json'
import OpenAI from 'openai'
import bodyParser = require('body-parser')

dotenv.config()

const app = express();

app.use(express.json())
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); 

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})


interface Category {
    question: string;
    choices: {
        [key: string]: string | Category;
    };
}

interface DataJson {
    categories: {
        [key: string]: Category;
    };
}

interface IdJson {
    "categories ID": {
        choices: {
            [key: string]: string;
        };
    };
}

const typedIdJson: IdJson = idJson as IdJson;
const typedDataJson: DataJson = dataJson as DataJson;


interface UserSession {
    category: string;
    step: number;
    answers: { [key: string]: string };
    currentQuestion?: string;
    currentChoices?: string[];
}

const userSessions: { [key: string]: UserSession } = {};



const startHandler: RequestHandler = (req, res):void => {
    const { userId, categoryId } = req.body;

    if (!userId || !categoryId) {
        res.status(400).json({ success: false, message: 'Missing userId or categoryId' });
        return
    }

    const category = typedIdJson["categories ID"].choices[categoryId];

    if (!category) {
      res.status(400).json({ success: false, message: 'Invalid category ID' });
      return
    }

    const categoryData = typedDataJson.categories[category];

    if (!categoryData) {
        res.status(400).json({ success: false, message: 'Category data not found' });
        return
    }

    // Store category in user's session
    userSessions[userId] = {
        category: category,
        step: 1,
        answers: {},
        currentQuestion: categoryData.question,
        currentChoices: Object.keys(categoryData.choices)
    };

    res.json({
        success: true,
        message: `You chose ${category}. Here's the first question:`,
        question: categoryData.question,
        choices: Object.keys(categoryData.choices)
    });
};


app.post('/api/start', startHandler);



app.get('/',  (req: Request, res: Response) => {
    res.send('Hello, TypeScript Express!');
});



const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

