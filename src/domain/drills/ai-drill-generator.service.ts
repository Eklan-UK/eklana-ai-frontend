import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type DrillType =
  | 'vocabulary'
  | 'pronunciation'
  | 'roleplay'
  | 'matching'
  | 'definition'
  | 'grammar'
  | 'sentence_writing'
  | 'fill_blank'
  | 'key_phrases'
  | 'summary';

interface GenerateDrillParams {
  drillType: DrillType;
  difficulty: string;
  context: string;
  prompt: string;
  topic: string;
  part: string;
}

type FunctionTool = Extract<OpenAI.Chat.Completions.ChatCompletionTool, { type: 'function' }>;

const tools: Record<DrillType, FunctionTool> = {
  vocabulary: {
    type: 'function',
    function: {
      name: 'generate_vocabulary',
      description: 'Generate vocabulary drill content',
      parameters: {
        type: 'object',
        properties: {
          target_sentences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                wordTranslation: { type: 'string' },
                text: { type: 'string' },
                translation: { type: 'string' },
              },
              required: ['word', 'wordTranslation', 'text', 'translation'],
            },
          },
        },
        required: ['target_sentences'],
      },
    },
  },

  pronunciation: {
    type: 'function',
    function: {
      name: 'generate_pronunciation',
      description: 'Generate pronunciation drill content',
      parameters: {
        type: 'object',
        properties: {
          pronunciation_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sound: { type: 'string' },
                word: { type: 'string' },
                sentence: { type: 'string' },
              },
              required: ['sound', 'word', 'sentence'],
            },
          },
        },
        required: ['pronunciation_items'],
      },
    },
  },

  roleplay: {
    type: 'function',
    function: {
      name: 'generate_roleplay',
      description: 'Generate roleplay drill content',
      parameters: {
        type: 'object',
        properties: {
          student_character_name: { type: 'string' },
          ai_character_names: {
            type: 'array',
            items: { type: 'string' },
          },
          drill_intro: { type: 'string' },
          roleplay_scenes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scene_name: { type: 'string' },
                context: { type: 'string' },
                dialogue: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      speaker: { type: 'string' },
                      text: { type: 'string' },
                      translation: { type: 'string' },
                    },
                    required: ['speaker', 'text', 'translation'],
                  },
                },
              },
              required: ['scene_name', 'context', 'dialogue'],
            },
          },
        },
        required: ['student_character_name', 'ai_character_names', 'drill_intro', 'roleplay_scenes'],
      },
    },
  },

  matching: {
    type: 'function',
    function: {
      name: 'generate_matching',
      description: 'Generate matching drill content',
      parameters: {
        type: 'object',
        properties: {
          matching_pairs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                left: { type: 'string' },
                right: { type: 'string' },
                leftTranslation: { type: 'string' },
                rightTranslation: { type: 'string' },
              },
              required: ['left', 'right', 'leftTranslation', 'rightTranslation'],
            },
          },
        },
        required: ['matching_pairs'],
      },
    },
  },

  definition: {
    type: 'function',
    function: {
      name: 'generate_definition',
      description: 'Generate definition drill content',
      parameters: {
        type: 'object',
        properties: {
          definition_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                hint: { type: 'string' },
              },
              required: ['word', 'hint'],
            },
          },
        },
        required: ['definition_items'],
      },
    },
  },

  grammar: {
    type: 'function',
    function: {
      name: 'generate_grammar',
      description: 'Generate grammar drill content',
      parameters: {
        type: 'object',
        properties: {
          grammar_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pattern: { type: 'string' },
                hint: { type: 'string' },
                example: { type: 'string' },
              },
              required: ['pattern', 'hint', 'example'],
            },
          },
        },
        required: ['grammar_items'],
      },
    },
  },

  sentence_writing: {
    type: 'function',
    function: {
      name: 'generate_sentence_writing',
      description: 'Generate sentence writing drill content',
      parameters: {
        type: 'object',
        properties: {
          sentence_writing_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                hint: { type: 'string' },
              },
              required: ['word', 'hint'],
            },
          },
        },
        required: ['sentence_writing_items'],
      },
    },
  },

  fill_blank: {
    type: 'function',
    function: {
      name: 'generate_fill_blank',
      description: 'Generate fill-in-the-blank drill content',
      parameters: {
        type: 'object',
        properties: {
          fill_blank_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                sentence: { type: 'string' },
                translation: { type: 'string' },
                blanks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      position: { type: 'number' },
                      correctAnswer: { type: 'string' },
                      options: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      hint: { type: 'string' },
                    },
                    required: ['position', 'correctAnswer', 'options', 'hint'],
                  },
                },
              },
              required: ['sentence', 'translation', 'blanks'],
            },
          },
        },
        required: ['fill_blank_items'],
      },
    },
  },

  key_phrases: {
    type: 'function',
    function: {
      name: 'generate_key_phrases',
      description: 'Generate key phrases drill content',
      parameters: {
        type: 'object',
        properties: {
          key_phrase_items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                respondentName: { type: 'string' },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                },
                correctAnswer: { type: 'string' },
              },
              required: ['prompt', 'respondentName', 'options', 'correctAnswer'],
            },
          },
        },
        required: ['key_phrase_items'],
      },
    },
  },

  summary: {
    type: 'function',
    function: {
      name: 'generate_summary',
      description: 'Generate summary drill content',
      parameters: {
        type: 'object',
        properties: {
          article_title: { type: 'string' },
          article_content: { type: 'string' },
        },
        required: ['article_title', 'article_content'],
      },
    },
  },
};

export async function generateDrill(params: GenerateDrillParams): Promise<Record<string, unknown>> {
  const tool: FunctionTool = tools[params.drillType];
  const toolsArray: OpenAI.Chat.Completions.ChatCompletionTool[] = [tool];

  const context = params.context.length > 500 ? params.context.slice(0, 500) : params.context;
  const prompt = params.prompt.length > 1000 ? params.prompt.slice(0, 1000) : params.prompt;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `This drill is for ${params.part}, Topic: ${params.topic}. If the drill includes translations, always translate to Korean unless the tutor explicitly specifies a different language.`,
      },
      {
        role: 'user',
        content: `Generate ${params.drillType} drill content.\nDifficulty: ${params.difficulty}\nContext: ${context}\n${prompt}`,
      },
    ],
    tools: toolsArray,
    tool_choice: { type: 'function', function: { name: tool.function.name } },
    temperature: 0.3,
    max_tokens: 1500,
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== 'function' || !toolCall.function.arguments) {
    throw new Error(`OpenAI did not return a tool call for drill type: ${params.drillType}`);
  }

  return JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
}
