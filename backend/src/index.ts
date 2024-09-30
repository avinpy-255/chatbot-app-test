import express, {Request, Response} from 'express'
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
});

const userSessions: any = {};

interface IdJson {
    "categories ID": {
        choices: {
            [key: string]: string;
        };
    };
}

const typedIdJson: IdJson = idJson as IdJson;


app.post ('/api/start', async (req: Request, res: Response) => {
    const { userId, categoryId } = req.body;

    const category = typedIdJson["categories ID"].choices[categoryId];
})



app.get('/',  (req: Request, res: Response) => {
    res.send('Hello, TypeScript Express!');
});



const port = process.env.PORT || 3000;

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

