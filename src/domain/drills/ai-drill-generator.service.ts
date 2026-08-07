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
  topic?: string;
  part?: string;
  studentContext?: object;
  drillWeaknesses?: object[];
  templatePrompt?: string;
  drillHistory?: object[];
  competencyFramework?: string;
  studentName?: string;
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
      description: 'Generate roleplay drill content. Every character that speaks in the dialogue must be listed in ai_character_names. No character should appear as a speaker in the dialogue unless they are declared in student_character_name or ai_character_names. For roleplay drills, the student_character_name must always be set to {studentName} if provided. Every dialogue turn must have its speaker field set to exactly one of the declared character names.',
      parameters: {
        type: 'object',
        properties: {
          student_character_name: { type: 'string' },
          ai_character_names: {
            type: 'array',
            items: { type: 'string' },
          },
          drill_intro: { type: 'string' },
          context: { type: 'string' },
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
                      speaker: {
                        type: 'string',
                        description: 'Must be set to exactly one of the declared character names: either student_character_name or one of ai_character_names. Never blank or a generic label.',
                      },
                      text: { type: 'string' },
                    },
                    required: ['speaker', 'text'],
                  },
                },
              },
              required: ['scene_name', 'context', 'dialogue'],
            },
          },
        },
        required: ['student_character_name', 'ai_character_names', 'drill_intro', 'context', 'roleplay_scenes'],
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
                context: {
                  type: 'string',
                  description: "Short situational setup that precedes the sentence, ending naturally before the quoted line (e.g. 'You haven't seen your colleague for several shifts, so you say:')",
                },
                sentence: { type: 'string', description: "IMPORTANT: The sentence MUST contain '___' (three underscores) where the blank should appear. Never write the answer into the sentence." },
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
              required: ['context', 'sentence', 'translation', 'blanks'],
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
                prompt: {
                  type: 'string',
                  description: 'Situation / scenario text shown to the learner',
                },
                options: {
                  type: 'array',
                  items: { type: 'string' },
                },
                correctAnswer: { type: 'string' },
              },
              required: ['prompt', 'options', 'correctAnswer'],
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

// Only touches scenes that are truly broken (every turn stamped with the identical speaker).
// Scenes where the AI already varied speakers are left untouched, since round-robin
// reassignment has no relation to which character actually said which line.
function normalizeRoleplaySpeakers(content: Record<string, unknown>): void {
  const studentCharacterName = content.student_character_name as string;
  const aiCharacterNames = (content.ai_character_names as string[]) ?? [];
  const allCharacters = [studentCharacterName, ...aiCharacterNames];

  const roleplayScenes = (content.roleplay_scenes as any[]) ?? [];

  console.log('[roleplay-normalize] allCharacters:', allCharacters);
  console.log('[roleplay-normalize] roleplayScenes speaker sets:', roleplayScenes.map((s: any) => [...new Set(s?.dialogue?.map((t: any) => t?.speaker))]));

  if (allCharacters.length < 2) return;

  for (const scene of roleplayScenes) {
    const dialogue = scene?.dialogue ?? [];
    if (dialogue.length < 2) continue;

    const speakers = new Set(dialogue.map((turn: any) => turn?.speaker));
    if (speakers.size > 1) continue;

    let characterIndex = 0;
    for (const turn of dialogue) {
      turn.speaker = allCharacters[characterIndex % allCharacters.length];
      characterIndex++;
    }
  }
}

// Returns null if the roleplay content is valid, or a description of the problem otherwise.
function validateRoleplayContent(content: Record<string, unknown>): string | null {
  const studentCharacterName = content.student_character_name as string | undefined;
  const aiCharacterNames = (content.ai_character_names as string[] | undefined) ?? [];
  const roleplayScenes = (content.roleplay_scenes as any[] | undefined) ?? [];

  if (!studentCharacterName) {
    return 'student_character_name is missing';
  }

  const declaredNames = new Set([studentCharacterName, ...aiCharacterNames]);
  const usedNames = new Set<string>();

  for (const scene of roleplayScenes) {
    for (const turn of scene?.dialogue ?? []) {
      const speaker = turn?.speaker;
      if (!speaker || !declaredNames.has(speaker)) {
        return `Dialogue turn has a speaker ("${speaker}") that is not student_character_name or one of ai_character_names`;
      }
      usedNames.add(speaker);
    }
  }

  if (!usedNames.has(studentCharacterName)) {
    return 'student_character_name never appears as a speaker in the dialogue';
  }

  if (usedNames.size < 2) {
    return 'Dialogue only ever uses a single character as speaker; expected the student and at least one AI character to alternate';
  }

  return null;
}

export async function generateDrill(
  params: GenerateDrillParams,
  retriesRemaining = 1
): Promise<Record<string, unknown>> {
  const tool: FunctionTool = tools[params.drillType];
  const toolsArray: OpenAI.Chat.Completions.ChatCompletionTool[] = [tool];

  const context = params.context.length > 500 ? params.context.slice(0, 500) : params.context;
  const prompt = params.prompt.length > 10000 ? params.prompt.slice(0, 10000) : params.prompt;

  const response = await openai.chat.completions.create({
    model: 'gpt-5.5',
    messages: [
      {
        role: 'system',
        content: [
          params.part && params.topic
            ? `This drill is for ${params.part}, Topic: ${params.topic}. Only include Korean translations for vocabulary drills (drill type: vocabulary). For all other drill types, do not include any translation fields. Do NOT copy or extract words directly from the prompt or context. Use the prompt and context only to understand the scenario and learning objectives. Generate original, clinically appropriate content that a nurse would realistically use in that situation.`
            : `Only include Korean translations for vocabulary drills (drill type: vocabulary). For all other drill types, do not include any translation fields. Do NOT copy or extract words directly from the prompt or context. Use the prompt and context only to understand the scenario and learning objectives. Generate original, clinically appropriate content that a nurse would realistically use in that situation.`,
          params.drillType === 'roleplay'
            ? `For roleplay drills, the student_character_name must always be set to ${params.studentName ? `"${params.studentName}"` : '{studentName}'} if provided. Every dialogue turn must have its speaker field set to exactly one of the declared character names. CRITICAL: The dialogue MUST alternate between the student character and the AI characters. It is FORBIDDEN for all dialogue turns to use the same speaker. Every scene must have turns spoken by the student_character_name AND at least one ai_character_name. If you use 3 characters, distribute turns across all 3.`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      {
        role: 'user',
        content: [
          params.templatePrompt ?? null,
          `Generate ${params.drillType} drill content.\nDifficulty: ${params.difficulty}\nContext: ${context}\n${prompt}`,
          params.studentContext
            ? `Student Context: ${JSON.stringify(params.studentContext)}`
            : null,
          params.drillWeaknesses?.length
            ? `Student Weaknesses to target: ${JSON.stringify(params.drillWeaknesses)}`
            : null,
          params.drillHistory?.length
            ? `Previous drills created for this student (avoid repeating content): ${JSON.stringify(params.drillHistory)}`
            : null,
          params.competencyFramework
            ? `Target these competencies in the generated drill content: ${params.competencyFramework}`
            : null,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
    tools: toolsArray,
    tool_choice: 'required',
    max_completion_tokens: 4000,
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  let content: Record<string, unknown> | undefined;
  if (toolCall && toolCall.type === 'function' && toolCall.function.arguments) {
    content = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } else {
    const textContent = response.choices[0]?.message?.content;
    if (textContent) {
      content = JSON.parse(textContent) as Record<string, unknown>;
    }
  }

  if (!content) {
    console.log("[ai-generate debug]", JSON.stringify(response.choices[0], null, 2));
    throw new Error(`OpenAI did not return a tool call or parseable content for drill type: ${params.drillType}`);
  }

  if (params.drillType === 'roleplay') {
    normalizeRoleplaySpeakers(content);
    const validationError = validateRoleplayContent(content);
    if (validationError) {
      if (retriesRemaining > 0) {
        console.log('[ai-generate debug] retrying roleplay generation:', validationError);
        return generateDrill(params, retriesRemaining - 1);
      }
      throw new Error(`Generated roleplay content failed validation: ${validationError}`);
    }
  }

  return content;
}
