// Mission 4: Interview Preparation
//
// Interview Preparation is a different category from Missions 1–3: it's about
// interview communication (behavioural, technical, and situational-judgement
// questions), not day-to-day clinical workplace communication. Because of that,
// every topic in this mission wants the SAME four drill shapes (pronunciation,
// vocabulary, key_phrases, roleplay) — only the subject matter changes.
//
// So instead of hand-authoring 4 prompts × 8 topics like the other mission
// files, this file defines ONE shared template per drill type below, and a
// single INTERVIEW_TOPIC_FOCUS config that describes what each topic's
// questions/scenarios should cover. The topic's `description` is spliced into
// the shared templates at module-load time.
//
// To add a new interview topic: add one entry to INTERVIEW_TOPIC_FOCUS and to
// the InterviewTopicId union below. You do NOT need to touch the four
// build*Prompt() functions or mission4Prompts — they pick it up automatically.

export type InterviewTopicId =
	| 'motivation_prep'
	| 'technical_prep'
	| 'situation_judgement_prep'
	| 'mock_1'
	| 'mock_2'
	| 'mock_3'
	| 'mock_4'
	| 'mock_5';

interface InterviewTopicFocus {
	/** Short phrase naming the question type, used inline in the shared templates. */
	focus: string;
	/** One paragraph describing exactly what this topic's items should cover. */
	description: string;
}

// The single place to add or edit interview topics. Every entry here
// automatically gets all 4 drill types generated from the shared templates below.
const INTERVIEW_TOPIC_FOCUS: Record<InterviewTopicId, InterviewTopicFocus> = {
	motivation_prep: {
		focus: 'behavioural interview questions',
		description:
			'Behavioural interview questions that explore the candidate\'s motivation for nursing, career choices, teamwork, and resilience — e.g. "Tell me about a time you handled a difficult situation with a patient" or "Why did you choose nursing?". Focus on communication style, self-reflection, and professionalism rather than clinical accuracy.',
	},
	technical_prep: {
		focus: 'clinical/technical interview questions',
		description:
			'Clinical and technical interview questions that test nursing knowledge, procedures, patient safety protocols, and clinical decision-making — e.g. "How would you manage a patient with a sudden drop in oxygen saturation?". Focus on accurate clinical reasoning communicated clearly and confidently.',
	},
	situation_judgement_prep: {
		focus: 'situational judgement scenarios',
		description:
			'Situational judgement scenarios that present an ethical or interpersonal workplace dilemma and ask the candidate to explain how they would respond — e.g. handling a disagreement with a colleague, reporting a near-miss error, or prioritising patients with competing needs. Focus on ethical reasoning, prioritisation, and professional judgement.',
	},
	mock_1: {
		focus: 'a short mixed mock interview',
		description:
			'A short, introductory mock interview combining 2–3 easier questions each from motivation, technical, and situational-judgement categories. This is the first mock in the sequence — keep pacing relaxed and questions predictable to build the candidate\'s confidence.',
	},
	mock_2: {
		focus: 'a mixed mock interview with follow-up questions',
		description:
			'A mock interview combining motivation, technical, and situational-judgement questions, now including occasional follow-ups (e.g. "Can you give a specific example?") that require the candidate to elaborate. Slightly less predictable question order than mock_1.',
	},
	mock_3: {
		focus: 'a realistic panel-style mock interview',
		description:
			'A realistic, panel-style mock interview combining all three question categories with natural follow-ups and clarifying questions from more than one interviewer voice. Moderate difficulty — the candidate should need to think on their feet.',
	},
	mock_4: {
		focus: 'a challenging full mock interview',
		description:
			'A challenging, full-length mock interview blending motivation, technical, and situational-judgement questions with layered follow-ups, mild pressure (tight time framing, probing "why" questions), and less predictable ordering — approaching real interview conditions.',
	},
	mock_5: {
		focus: 'the most realistic full mock interview',
		description:
			'The most realistic full mock interview simulation: a natural blend of motivation, technical, and situational-judgement questions delivered the way a real hospital hiring panel would conduct it, with unpredictable ordering, layered follow-ups, and no signposting of which category each question belongs to. This is the final, hardest mock before a real interview.',
	},
};

const INTERVIEW_TOPIC_IDS = Object.keys(INTERVIEW_TOPIC_FOCUS) as InterviewTopicId[];

function buildPronunciationPrompt(topic: InterviewTopicId): string {
	const { description } = INTERVIEW_TOPIC_FOCUS[topic];
	return `You are a clinical English language coach for Korean nurses preparing for nursing job interviews in {{country}}.

Generate a pronunciation drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week:
{{weak_phonemes}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Pronunciation Selection

- Prioritize the student's weak phonemes ({{weak_phonemes}}).
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used during nursing job interviews.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Adapt the vocabulary naturally according to the selected topic ({{topic}}):
  - Motivation Prep
  - Technical Prep
  - Situational Judgement Prep
  - Mock Interviews

Examples include:

- compassionate
- resilience
- collaboration
- accountability
- professionalism
- prioritisation
- delegation
- assessment
- intervention
- communication
- confidentiality
- advocacy
- leadership
- adaptability
- multidisciplinary
- evidence-based
- deterioration
- rehabilitation
- empathy
- patient-centred

3. Interview Context

- Every sentence should sound like authentic communication during a nursing job interview in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect how a nurse would answer interview questions.
- Include realistic interview topics such as:
  - introducing yourself
  - discussing clinical experience
  - explaining clinical reasoning
  - describing teamwork
  - handling difficult situations
  - patient safety
  - leadership
  - communication
  - ethical decision making
  - prioritisation
  - career goals
  - motivation for nursing

Examples:

- "I believe effective communication is essential for patient safety."
- "I always prioritise patient-centred care when making clinical decisions."
- "I would immediately escalate any significant deterioration in the patient's condition."
- "My previous role taught me the importance of collaboration within a multidisciplinary team."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- introduce themselves professionally
- explain motivation clearly
- communicate clinical reasoning
- demonstrate patient-centred care
- discuss teamwork and leadership
- answer behavioural interview questions confidently
- respond appropriately to situational judgement questions
- communicate naturally and fluently throughout an interview

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult interview terminology.
- Include words from different categories, including:
  - behavioural interview language
  - clinical terminology
  - leadership
  - communication
  - patient safety
  - teamwork
  - ethics
  - prioritisation
  - professional values
  - evidence-based practice

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{interview vocabulary}}",
    "sentence": "{{natural interview response}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.
`;
}

function buildVocabularyPrompt(topic: InterviewTopicId): string {
	const { description } = INTERVIEW_TOPIC_FOCUS[topic];
	return `You are a clinical English language coach for Korean nurses preparing for nursing job interviews in {{country}}.

Generate a fill-in-the-blank interview vocabulary drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

2. Clinical Context

- Every sentence should describe a realistic nursing job interview in {{country}}.
- The learner always plays the interview candidate.
- The interviewer asks questions or presents situations requiring the learner to demonstrate professional communication and nursing knowledge.
- Replace only the target vocabulary with the blank.
- Every sentence should contain enough context that only one answer is correct.
- Adapt the content naturally to the selected topic ({{topic}}):
  - Motivation Prep
  - Technical Prep
  - Situational Judgement Prep
  - Mock Interviews

3. Vocabulary Selection

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used during nursing interviews.
- Use authentic interview and clinical vocabulary.

Examples include:

- compassionate
- resilience
- collaboration
- accountability
- professionalism
- prioritisation
- delegation
- assessment
- intervention
- communication
- confidentiality
- advocacy
- escalation
- leadership
- evidence-based practice
- patient-centred care
- critical thinking
- multidisciplinary
- empathy
- adaptability

Do not repeat vocabulary.

4. Realistic Answer Choices

- Provide four legitimate interview-related answer choices.
- Exactly one option must be correct.
- The remaining options should also be authentic nursing or professional vocabulary.
- Avoid obviously incorrect or unrelated words.
- At least half of the questions should contain multiple plausible options so the learner must use context and professional judgement.

The correct answer should reinforce one or more of the following:

- professional communication
- patient-centred care
- teamwork
- clinical reasoning
- ethical decision making
- leadership
- patient safety
- accountability
- interview communication

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen recognition and understanding of vocabulary commonly used during nursing job interviews while improving professional English communication.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary.
- Every sentence should sound like something an interviewer or interview candidate would naturally say.
- Avoid dictionary definitions or generic examples.

Examples:

- "When caring for multiple unstable patients, I use ______ to decide which patient requires immediate attention."
- "Patient ______ is always my highest priority during every shift."
- "I believe effective ______ helps prevent misunderstandings within the multidisciplinary team."

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging interview vocabulary.
- Require understanding of the interview context rather than simple vocabulary recognition.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.
`;
}

function buildKeyPhrasesPrompt(topic: InterviewTopicId): string {
	const { description } = INTERVIEW_TOPIC_FOCUS[topic];
	return `You are a clinical English language coach for Korean nurses preparing for nursing job interviews in {{country}}.

Generate a key phrases drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week:
{{missed_phrases}}

Generate 10–15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Interviewer says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Interview Context

- Every conversation should reflect a realistic nursing job interview in {{country}}.
- The learner always plays the interview candidate.
- The AI plays one or more interviewers such as a Nurse Manager, Clinical Educator, Human Resources Manager, Director of Nursing, or Clinical Supervisor.
- Adapt the interview naturally according to the selected topic ({{topic}}):
  - Motivation Prep
  - Technical Prep
  - Situational Judgement Prep
  - Mock Interviews
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic interview language commonly heard in healthcare recruitment.

3. Important Requirements

- Every correct answer must naturally include one or more phrases from {{missed_phrases}} whenever appropriate.
- Every scenario should reinforce one or more of the following interview competencies:
  - introducing yourself professionally
  - explaining your motivation
  - describing clinical reasoning
  - demonstrating patient-centred care
  - explaining teamwork and collaboration
  - answering behavioural questions using structured examples
  - responding appropriately to ethical or situational questions
  - communicating confidently and professionally

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses realistic interview answers.
- At least half of the questions should contain two or more responses that an experienced nurse could realistically give.
- The learner must identify the MOST professional, complete, and persuasive response.

The correct response should demonstrate one or more of the following:

- answers the interview question directly
- provides a logical and organised response
- demonstrates sound clinical judgement when appropriate
- reflects professionalism and accountability
- emphasises teamwork and patient safety
- communicates confidence without sounding rehearsed
- uses clear, natural English
- includes appropriate examples or reasoning where relevant

Incorrect responses should be plausible but less appropriate because they:

- provide incomplete answers
- fail to answer the actual question
- demonstrate weaker communication
- omit important reasoning
- focus on the wrong priority
- sound less professional or less confident

5. Scenario Variety

Include a balanced mix of interview questions involving:

- tell me about yourself
- why do you want to work here?
- why should we hire you?
- strengths and weaknesses
- career goals
- teamwork
- leadership
- communication
- conflict resolution
- difficult patients or families
- prioritisation
- medication safety
- infection prevention
- patient advocacy
- ethical dilemmas
- handling mistakes
- stressful situations
- clinical decision making
- cultural competence
- questions for the interviewer

The mix of questions should naturally reflect the selected topic.

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication during nursing job interviews.

Every option should sound like something a qualified nurse could realistically say in an interview.

The correct answer must be unambiguously the strongest response for the specific interview question.

Return a JSON array:

[
  {
    "respondentName": "{{Interviewer Name}}",
    "role": "{{Interviewer Role}}",
    "prompt": "{{What the interviewer says}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.
`;
}

function buildRoleplayPrompt(topic: InterviewTopicId): string {
	const { description } = INTERVIEW_TOPIC_FOCUS[topic];
	return `You are a clinical English language coach for Korean nurses preparing for nursing job interviews in {{country}}.

Generate an interview roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these interview scenarios this week:
{{practiced_scenarios}}

Generate a multi-scene interview roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected interview scenes that reflect realistic nursing job interviews in {{country}}.
- Base the interview on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- Adapt the interview naturally according to the topic ({{topic}}). For example:
  - Motivation Prep: behavioural and motivation questions.
  - Technical Prep: clinical knowledge and nursing practice questions.
  - Situational Judgement Prep: behavioural and ethical scenarios.
  - Mock Interviews: a balanced mix of all interview types.
- The student always plays the interview candidate.
- The AI plays one or more interviewers.
- The interview should progress naturally from introductions to increasingly challenging questions, followed by a professional conclusion.

2. Characters

- Name the student using student_character_name.
- AI interviewers must have realistic names appropriate for hospitals in {{country}}.

Examples:
- Sarah Johnson (Nurse Manager)
- Michael Patel (Clinical Educator)
- Emily Rodriguez (Human Resources Manager)
- James Wilson (Director of Nursing)

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic interview language commonly used by hospitals in {{country}}.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.
- Interviewers should ask realistic follow-up questions based on the student's previous responses.

4. Interview Competencies

The roleplay should naturally allow the learner to demonstrate:

- introducing themselves confidently and professionally
- communicating clearly and naturally
- organising answers logically
- explaining clinical reasoning when appropriate
- demonstrating professionalism, empathy, teamwork, leadership, and patient-centred care
- answering behavioural questions with structured examples
- responding appropriately to situational judgement questions
- remaining calm under pressure
- asking thoughtful questions when invited

5. Realism

Include realistic interview questions covering topics such as:

- personal introduction
- motivation for nursing
- career goals
- strengths and weaknesses
- teamwork
- communication
- conflict resolution
- patient safety
- prioritisation
- difficult patients or families
- clinical decision making
- ethical dilemmas
- medication safety
- infection prevention
- deteriorating patients
- leadership
- time management
- cultural competence
- stress management
- hospital values

The mix of questions should naturally reflect the selected topic.

Interviewers should occasionally ask follow-up questions requesting clarification or examples.

6. Learning Objective

The learner should develop automatic, confident, natural English communication during nursing job interviews.

The learner should practise:

- answering interview questions fluently
- explaining clinical reasoning clearly
- giving structured behavioural examples
- communicating professionally
- responding confidently to unexpected follow-up questions
- maintaining a conversational rather than memorised speaking style

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{Interviewer Name}}",
    "{{Interviewer Name}}"
  ],
  "context": "{{Brief interview description}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON.
No markdown.
No explanation.
`;
}

export const mission4Prompts: Record<string, {
	pronunciation: string;
	vocabulary: string;
	key_phrases: string;
	roleplay: string;
}> = Object.fromEntries(
	INTERVIEW_TOPIC_IDS.map((topic) => [
		topic,
		{
			pronunciation: buildPronunciationPrompt(topic),
			vocabulary: buildVocabularyPrompt(topic),
			key_phrases: buildKeyPhrasesPrompt(topic),
			roleplay: buildRoleplayPrompt(topic),
		},
	]),
);
