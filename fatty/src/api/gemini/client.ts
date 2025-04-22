import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
    apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
});

const model = 'gemini-2.5-flash-preview-04-17';
const config = {
  responseMimeType: 'text/plain',
};

export async function analyzeImage(base64Image: string): Promise<string> {
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `
You are an AI assistant tasked with determining whether an object in an image has a defect or not. Your goal is to analyze the image provided and categorize it into one of two categories: "Defect Present" or "No Defect." Only defects that are large and significant should be identified as "Defect Present." Minor, small, or insignificant imperfections should be categorized as "No Defect."

Please follow these instructions:

1. Carefully examine the entire image to identify any defects on the object.
2. Assess the size and significance of any defect found. Only classify as "Defect Present" if the defect is clearly large and materially affects the object's quality or function.
3. If no such large or significant defects are observed, classify the image as "No Defect."
4. Provide your classification clearly and concisely.

# Output Format

Respond only with one of the following exact phrases:

- Defect Present
- No Defect

Do not add any additional commentary or explanation unless specifically requested.

# Notes

- You will be given images with objects; focus exclusively on identifying large and significant defects.
- Avoid false positives by ignoring small scratches, minor discolorations, or insignificant blemishes.`,
        },
      ],
    },
    {
      role: 'model',
      parts: [
        {
          text: `The user wants me to analyze an image and classify it based on the presence of *large and significant* defects.
I need to be strict about the definition of "large and significant". Small imperfections should be ignored.
The output must be exactly "Defect Present" or "No Defect".

I need to wait for the image to be provided.
Once the image is provided, I will:
1. Look at the object in the image.
2. Scan for any imperfections.
3. Evaluate the size and impact of any found imperfections.
4. If any imperfection is large and significant according to the user's criteria, I will classify it as "Defect Present".
5. If only small/minor/insignificant imperfections are present, or no imperfections, I will classify it as "No Defect".
6. I will output only the chosen classification phrase.`,
        },
        {
          text: `Please provide the image you would like me to analyze.`,
        },
      ],
    },
    {
      role: 'user',
      parts: [
        {
          text: `Here is the image I would like you to analyze:`,
          image: {
            base64: base64Image,
          },
        },
      ],
    },
  ];


  try {
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let result = '';
    console.log('AI is starting to analyze the image...');
    for await (const chunk of response) {
      console.log('AI thinking process:', chunk.text);
      result += chunk.text;
    }
    console.log('AI analysis complete.');
    return result.trim();
  } catch (error: any) {
    console.error('Error from Gemini API:', error.response?.data || error.message);
    throw new Error('Failed to analyze image');
  }
}