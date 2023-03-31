import { config } from "dotenv";
import { Configuration, OpenAIApi } from "openai";

config();

const openai = new OpenAIApi(
  new Configuration({
    apiKey: process.env.CHAT_GPT_API_KEY,
  })
);

openai
  .createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Give me some exercises for back" }],
  })
  .then((res) => {
    console.log(res.data.choices);
  });
