import { openai } from "@ai-sdk/openai";
import { generateText, streamText, tool } from "ai";
import { text } from "stream/consumers";
import { z } from "zod";

interface WeatherData {
  main: {
    temp: number;
    humidity: number;
  };
  weather: {
    description: string;
  }[];
}

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const fetchWeather = async (location: string): Promise<WeatherData> => {
    const apiKey = process.env.REACT_APP_WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("Weather API key not found");
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=metric`
    );
    if (!response.ok) {
      throw new Error("Weather data not available");
    }
    return response.json();
  };

  const result = await streamText({
    model: openai("gpt-4o"),
    messages: [
      ...messages,
      {
        role: "system",
        content:
          "You have access to a weather tool that gives human-readable weather information. Use it to respond to weather-related queries in a conversational manner.",
      },
    ],
    tools: {
      weather: tool({
        description: "Get the weather for the user's location",
        parameters: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => {
          const weatherData = await fetchWeather(location);
          const weather = weatherData.weather[0].description;
          const temperature = weatherData.main.temp;

          // return `The weather in ${location} is ${weather} with a temperature of ${temperature}°C.`;
          const weatherOutput = await generateText({
            model: openai("gpt-4o"),
            prompt: `Describe the weather in ${location} in a controversial and fun manner but short. 
    Current conditions: ${weather}, temperature: ${temperature}°C, humidity: ${weatherData.main.humidity}%. Announce weather location and time.`,
          });

          // for await (const textPart of weatherOutput.textStream) {
          //   console.log(textPart);
          //   return textPart;
          // }

          return weatherOutput.text;
        },
      }),
    },
  });

  // Now return just the AI's result (without showing tool invocation details)
  return result.toDataStreamResponse();
}
